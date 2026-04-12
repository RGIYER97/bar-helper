import { useState } from "react";

const SUGGESTIONS = [
  "Vodka", "Rum", "Gin", "Tequila", "Whiskey", "Bourbon",
  "Triple Sec", "Lime Juice", "Lemon Juice", "Orange Juice",
  "Cranberry Juice", "Pineapple Juice", "Coconut Cream",
  "Simple Syrup", "Grenadine", "Soda Water", "Tonic Water",
  "Mint", "Bitters", "Vermouth", "Kahlua", "Amaretto",
  "Blue Curacao", "Campari", "Aperol", "Prosecco",
];

export default function IngredientInput({ ingredients, onAdd, onRemove }) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = SUGGESTIONS.filter(
    (s) =>
      s.toLowerCase().includes(input.toLowerCase()) &&
      !ingredients.some((i) => i.toLowerCase() === s.toLowerCase()),
  );

  function add(value) {
    const trimmed = value.trim();
    if (trimmed && !ingredients.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      onAdd(trimmed);
    }
    setInput("");
    setShowSuggestions(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(input);
    }
  }

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Type an ingredient (e.g. Vodka, Lime Juice)…"
          className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-gray-100 placeholder-gray-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />

        {showSuggestions && input.length > 0 && filtered.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-lg">
            {filtered.slice(0, 8).map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={() => add(s)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-brand-500/20 hover:text-white transition"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ingredients.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {ingredients.map((ing) => (
            <span
              key={ing}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/20 px-3 py-1 text-sm font-medium text-brand-300"
            >
              {ing}
              <button
                type="button"
                onClick={() => onRemove(ing)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-brand-500/30 transition"
                aria-label={`Remove ${ing}`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
