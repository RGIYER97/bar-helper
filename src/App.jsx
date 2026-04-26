import { useState, useEffect, useRef, useMemo } from "react";
import IngredientInput from "./components/IngredientInput";
import DrinkCard from "./components/DrinkCard";
import SavedDrinks from "./components/SavedDrinks";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { fetchDrinksByIngredients, fetchCreativeDrinks, fetchIbaCocktails } from "./utils/api";
import { setCachedImage, isDataImageUrl } from "./utils/imageCache.js";

const TABS = ["discover", "saved"];

export default function App() {
  const [ingredients, setIngredients] = useLocalStorage("bar-help-ingredients", []);
  const [results, setResults] = useState([]);
  const [ibaResults, setIbaResults] = useState([]);
  const [almostDrinks, setAlmostDrinks] = useState([]);
  const [creativeDrinks, setCreativeDrinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creativeLoading, setCreativeLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("discover");
  const [moodPrompt, setMoodPrompt] = useState("");
  const [savedDrinks, setSavedDrinks] = useLocalStorage("bar-help-saved", []);
  const savedDrinksRef = useRef(savedDrinks);
  savedDrinksRef.current = savedDrinks;

  /**
   * One-shot: move legacy base64 images out of localStorage into IndexedDB.
   * Uses a snapshot so we do not clobber saves that happen while migration runs.
   */
  useEffect(() => {
    let cancelled = false;
    const snapshot = savedDrinksRef.current;
    (async () => {
      if (!snapshot.some((d) => isDataImageUrl(d.image))) return;
      const migrated = [];
      for (const d of snapshot) {
        if (cancelled) return;
        if (isDataImageUrl(d.image)) {
          await setCachedImage(d, d.image);
          migrated.push({ ...d, image: null });
        } else migrated.push(d);
      }
      if (cancelled) return;
      setSavedDrinks((latest) => {
        if (latest.length !== snapshot.length) return latest;
        for (let i = 0; i < latest.length; i++) {
          if (latest[i].id !== snapshot[i].id) return latest;
        }
        return migrated;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  function addIngredient(ing) {
    setIngredients((prev) => [...prev, ing]);
  }

  function removeIngredient(ing) {
    setIngredients((prev) => prev.filter((i) => i !== ing));
  }

  const shoppingList = useMemo(() => {
    const map = {};
    almostDrinks.forEach((drink) => {
      const key = drink.missingIngredient.toLowerCase().trim();
      if (!map[key]) map[key] = { ingredient: drink.missingIngredient, drinks: [] };
      map[key].drinks.push(drink.name);
    });
    return Object.values(map)
      .sort((a, b) => b.drinks.length - a.drinks.length)
      .slice(0, 6);
  }, [almostDrinks]);

  async function handleSearch() {
    if (!ingredients.length) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setIbaResults([]);
    setAlmostDrinks([]);
    setCreativeDrinks([]);
    try {
      const [{ exact: drinks, almost: almostCDB }, { exact: ibaExact, almost: almostIba }] =
        await Promise.all([
          fetchDrinksByIngredients(ingredients),
          Promise.resolve(fetchIbaCocktails(ingredients)),
        ]);

      const exactNames = new Set(drinks.map((d) => d.name.toLowerCase().trim()));
      const iba = ibaExact.filter((d) => !exactNames.has(d.name.toLowerCase().trim()));

      // Merge almost lists, deduplicate by name (CocktailDB wins — it has images)
      const almostSeen = new Set([...exactNames, ...iba.map((d) => d.name.toLowerCase().trim())]);
      const almost = [];
      for (const d of [...almostCDB, ...almostIba]) {
        const key = d.name.toLowerCase().trim();
        if (!almostSeen.has(key)) {
          almostSeen.add(key);
          almost.push(d);
        }
      }

      setResults(drinks);
      setIbaResults(iba);
      setAlmostDrinks(almost.slice(0, 18));
      if (!drinks.length && !iba.length && !almost.length)
        setError("No drinks found — try different ingredients.");
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

  async function saveDrink(drink) {
    let record = { ...drink, rating: 0, notes: "", savedAt: Date.now() };
    if (isDataImageUrl(drink.image)) {
      await setCachedImage(drink, drink.image);
      record = { ...record, image: null };
    }
    setSavedDrinks((prev) => {
      if (prev.some((d) => d.id === drink.id)) return prev;
      return [...prev, record];
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

          {/* IBA Classics */}
          {ibaResults.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-1 text-lg font-semibold text-white">
                IBA Classics
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({ibaResults.length} found)
                </span>
              </h2>
              <p className="mb-4 text-xs text-gray-500">
                Official International Bartenders Association recipes
              </p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {ibaResults.map((drink) => (
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

          {/* What to Buy */}
          {shoppingList.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-1 text-lg font-semibold text-white">What to Buy</h2>
              <p className="mb-4 text-xs text-gray-500">
                One ingredient away from these drinks
              </p>
              <div className="flex flex-col gap-3">
                {shoppingList.map(({ ingredient, drinks }) => (
                  <div
                    key={ingredient}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3"
                  >
                    <span className="font-semibold text-amber-300">{ingredient}</span>
                    <span className="text-xs text-gray-500">
                      unlocks {drinks.length} drink{drinks.length > 1 ? "s" : ""}
                    </span>
                    <span className="text-sm text-gray-400">{drinks.join(", ")}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Almost There */}
          {almostDrinks.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-1 text-lg font-semibold text-white">Almost There</h2>
              <p className="mb-4 text-xs text-gray-500">
                You're one ingredient away from each of these
              </p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {almostDrinks.map((drink) => (
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
