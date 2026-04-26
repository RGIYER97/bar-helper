import { useState } from "react";

const INGREDIENTS = [
  "Absinthe", "Aged rum", "Agave nectar", "Amaretto", "Amaro", "Angostura bitters",
  "Aperol", "Apricot brandy", "Armagnac",
  "Bacardi White Rum", "Baileys Irish Cream", "Blackberry liqueur", "Blue Curacao",
  "Bourbon whiskey", "Brandy", "Brown Créme de Cacao",
  "Cachaca", "Calvados", "Campari", "Chambord", "Champagne", "Cherry liqueur",
  "Citron Vodka", "Coconut cream", "Coconut milk", "Coffee liqueur", "Cognac",
  "Cointreau", "Cola", "Cranberry juice", "Cream", "Créme de Cassis",
  "DOM Bénédictine", "Dark rum", "DiSaronno", "Drambuie", "Dry White Wine", "Dry vermouth",
  "Egg white", "Egg yolk", "Elderflower liqueur",
  "Fernet",
  "Galliano", "Gin", "Ginger Ale", "Ginger beer", "Gold rum", "Gomme syrup",
  "Grand Marnier", "Grapefruit juice", "Green Créme de Menthe", "Grenadine",
  "Honey syrup", "Hot coffee",
  "Irish whiskey",
  "Kahlúa", "Kirsch",
  "Lemon juice", "Lillet Blonde", "Lime juice",
  "Maraschino", "Mezcal",
  "Old Tom Gin", "Olive juice", "Orange Bitters", "Orange Curaçao", "Orange juice",
  "Orgeat syrup",
  "Peach puree", "Peach schnapps", "Peychaud's bitters", "Pimm's No. 1",
  "Pineapple juice", "Pisco", "Prosecco",
  "Raspberry liqueur", "Raspberry syrup", "Red Port", "Red vermouth", "Rum", "Rye whiskey",
  "Scotch whisky", "Silver Tequila", "Simple syrup", "Sloe gin", "Soda water",
  "Spiced rum", "Sugar syrup", "Sweet red vermouth",
  "Tequila", "Tomato juice", "Tonic Water", "Triple Sec",
  "Vodka",
  "Whiskey", "White Créme de Cacao", "White Créme de Menthe", "White Cuban Rum", "White rum",
];

export default function IngredientInput({ ingredients, onAdd, onRemove }) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = INGREDIENTS.filter(
    (s) =>
      s.toLowerCase().includes(input.toLowerCase()) &&
      !ingredients.some((i) => i.toLowerCase() === s.toLowerCase()),
  ).slice(0, 8);

  function add(value) {
    const trimmed = value.trim();
    if (trimmed && !ingredients.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      onAdd(trimmed);
    }
    setInput("");
    setShowSuggestions(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showSuggestions) { setShowSuggestions(true); return; }
      setActiveIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : filtered.length - 1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (activeIndex >= 0 && filtered[activeIndex]) {
        add(filtered[activeIndex]);
      } else {
        add(input);
      }
    }
  }

  function highlightMatch(text) {
    if (!input) return text;
    const idx = text.toLowerCase().indexOf(input.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <strong className="font-semibold text-white">{text.slice(idx, idx + input.length)}</strong>
        {text.slice(idx + input.length)}
      </>
    );
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
            setActiveIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => { setShowSuggestions(false); setActiveIndex(-1); }, 150)}
          onKeyDown={handleKeyDown}
          placeholder="Type an ingredient (e.g. Vodka, Lime Juice)…"
          className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-gray-100 placeholder-gray-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />

        {showSuggestions && input.length > 0 && filtered.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-lg">
            {filtered.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={() => add(s)}
                  className={`w-full px-4 py-2 text-left text-sm transition ${
                    i === activeIndex
                      ? "bg-brand-500/30 text-white"
                      : "text-gray-300 hover:bg-brand-500/20 hover:text-white"
                  }`}
                >
                  {highlightMatch(s)}
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
                className="ml-0.5 rounded-full p-0.5 transition hover:bg-brand-500/30"
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
