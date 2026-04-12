import { useState } from "react";
import IngredientInput from "./components/IngredientInput";
import DrinkCard from "./components/DrinkCard";
import SavedDrinks from "./components/SavedDrinks";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { fetchDrinksByIngredients, fetchCreativeDrinks } from "./utils/api";

const TABS = ["discover", "saved"];

export default function App() {
  const [ingredients, setIngredients] = useLocalStorage("bar-help-ingredients", []);
  const [results, setResults] = useState([]);
  const [creativeDrinks, setCreativeDrinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creativeLoading, setCreativeLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("discover");
  const [moodPrompt, setMoodPrompt] = useState("");
  const [savedDrinks, setSavedDrinks] = useLocalStorage("bar-help-saved", []);

  function addIngredient(ing) {
    setIngredients((prev) => [...prev, ing]);
  }

  function removeIngredient(ing) {
    setIngredients((prev) => prev.filter((i) => i !== ing));
  }

  async function handleSearch() {
    if (!ingredients.length) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setCreativeDrinks([]);
    try {
      const drinks = await fetchDrinksByIngredients(ingredients);
      setResults(drinks);
      if (!drinks.length) setError("No drinks found — try different ingredients.");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreative() {
    if (!ingredients.length) return;
    setCreativeLoading(true);
    setError(null);
    setCreativeDrinks([]);
    try {
      const drinks = await fetchCreativeDrinks(ingredients, moodPrompt);
      setCreativeDrinks(drinks);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreativeLoading(false);
    }
  }

  function saveDrink(drink) {
    setSavedDrinks((prev) => {
      if (prev.some((d) => d.id === drink.id)) return prev;
      return [...prev, { ...drink, rating: 0, notes: "", savedAt: Date.now() }];
    });
  }

  function updateSavedDrink(id, updates) {
    setSavedDrinks((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    );
  }

  function removeSavedDrink(id) {
    setSavedDrinks((prev) => prev.filter((d) => d.id !== id));
  }

  const isSaved = (id) => savedDrinks.some((d) => d.id === id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          <span className="text-brand-400">Bar</span> Help
        </h1>
        <p className="mt-2 text-gray-400">
          Tell us what you have — we'll tell you what to make.
        </p>
      </header>

      {/* Tabs */}
      <nav className="mb-8 flex justify-center gap-1 rounded-xl bg-gray-900 p-1 border border-gray-800">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium capitalize transition ${
              tab === t
                ? "bg-brand-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "saved" ? `Saved (${savedDrinks.length})` : t}
          </button>
        ))}
      </nav>

      {/* ───── Discover Tab ───── */}
      {tab === "discover" && (
        <>
          <IngredientInput
            ingredients={ingredients}
            onAdd={addIngredient}
            onRemove={removeIngredient}
          />

          <div className="mt-5">
            <button
              type="button"
              onClick={handleSearch}
              disabled={!ingredients.length || loading}
              className="w-full rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Searching…
                </span>
              ) : (
                "Find Drinks"
              )}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <label
              htmlFor="mood-prompt"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              What are you in the mood for?{" "}
              <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id="mood-prompt"
              value={moodPrompt}
              onChange={(e) => setMoodPrompt(e.target.value)}
              placeholder="e.g. Something refreshing and citrusy, or a strong spirit-forward sipper, or tiki vibes…"
              rows={2}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <button
              type="button"
              onClick={handleCreative}
              disabled={!ingredients.length || creativeLoading}
              className="mt-3 w-full rounded-xl border border-brand-500 px-6 py-3 text-sm font-semibold text-brand-400 transition hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              {creativeLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Inventing…
                </span>
              ) : (
                "✨ Get Creative (AI)"
              )}
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Creative results */}
          {creativeDrinks.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-4 text-lg font-semibold text-white">
                AI Recommendations
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({creativeDrinks.length} drink{creativeDrinks.length > 1 ? "s" : ""})
                </span>
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {creativeDrinks.map((drink) => (
                  <DrinkCard
                    key={drink.id}
                    drink={drink}
                    onSave={saveDrink}
                    isSaved={isSaved(drink.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* CocktailDB results */}
          {results.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Matching Drinks
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({results.length} found)
                </span>
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((drink) => (
                  <DrinkCard
                    key={drink.id}
                    drink={drink}
                    onSave={saveDrink}
                    isSaved={isSaved(drink.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ───── Saved Tab ───── */}
      {tab === "saved" && (
        <SavedDrinks
          drinks={savedDrinks}
          onUpdate={updateSavedDrink}
          onRemove={removeSavedDrink}
        />
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
