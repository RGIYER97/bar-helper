import { useMemo, useEffect, useState } from "react";
import DrinkCard from "./DrinkCard";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { getCachedImage } from "../utils/imageCache.js";

const SORT_RECENT = "recent";
const SORT_OLDEST = "oldest";
const SORT_RATING_HIGH = "rating-high";
const SORT_RATING_LOW = "rating-low";
/** Legacy key from earlier builds */
const LEGACY_RATING = "rating";

function tieBreakRecent(a, b) {
  return (b.savedAt ?? 0) - (a.savedAt ?? 0);
}

function tieBreakOldest(a, b) {
  return (a.savedAt ?? 0) - (b.savedAt ?? 0);
}

export default function SavedDrinks({ drinks, onUpdate, onRemove }) {
  const [sortBy, setSortBy] = useLocalStorage("bar-help-saved-sort", SORT_RECENT);
  /** AI images live in IndexedDB; merge resolved URLs for display. */
  const [idbImages, setIdbImages] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updates = {};
      await Promise.all(
        drinks.map(async (d) => {
          if (d.image || d.source !== "gemini") return;
          const url = await getCachedImage(d);
          if (url) updates[d.id] = url;
        }),
      );
      if (!cancelled) setIdbImages((prev) => ({ ...prev, ...updates }));
    })();
    return () => {
      cancelled = true;
    };
  }, [drinks]);

  const sortedDrinks = useMemo(() => {
    const mode =
      sortBy === SORT_OLDEST || sortBy === SORT_RATING_LOW
        ? sortBy
        : sortBy === SORT_RATING_HIGH || sortBy === LEGACY_RATING
          ? SORT_RATING_HIGH
          : SORT_RECENT;

    const copy = [...drinks];
    if (mode === SORT_RECENT) {
      copy.sort((a, b) => tieBreakRecent(a, b));
    } else if (mode === SORT_OLDEST) {
      copy.sort((a, b) => tieBreakOldest(a, b));
    } else if (mode === SORT_RATING_HIGH) {
      copy.sort((a, b) => {
        const ra = a.rating || 0;
        const rb = b.rating || 0;
        if (rb !== ra) return rb - ra;
        return tieBreakRecent(a, b);
      });
    } else {
      copy.sort((a, b) => {
        const ra = a.rating || 0;
        const rb = b.rating || 0;
        const ua = ra === 0;
        const ub = rb === 0;
        if (ua && ub) return tieBreakRecent(a, b);
        if (ua) return 1;
        if (ub) return -1;
        if (ra !== rb) return ra - rb;
        return tieBreakRecent(a, b);
      });
    }
    return copy;
  }, [drinks, sortBy]);

  const activeMode =
    sortBy === SORT_OLDEST || sortBy === SORT_RATING_LOW
      ? sortBy
      : sortBy === SORT_RATING_HIGH || sortBy === LEGACY_RATING
        ? SORT_RATING_HIGH
        : SORT_RECENT;

  if (!drinks.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-700 p-10 text-center">
        <p className="text-gray-500">No saved drinks yet. Find some drinks and save your favourites!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-400">Sort by</span>
        <div className="flex flex-wrap gap-1 rounded-xl bg-gray-900 p-1 border border-gray-800">
          <button
            type="button"
            onClick={() => setSortBy(SORT_RECENT)}
            className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-medium transition sm:flex-none sm:px-3 sm:text-sm ${
              activeMode === SORT_RECENT
                ? "bg-brand-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Recently saved
          </button>
          <button
            type="button"
            onClick={() => setSortBy(SORT_OLDEST)}
            className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-medium transition sm:flex-none sm:px-3 sm:text-sm ${
              activeMode === SORT_OLDEST
                ? "bg-brand-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Oldest saved
          </button>
          <button
            type="button"
            onClick={() => setSortBy(SORT_RATING_HIGH)}
            className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-medium transition sm:flex-none sm:px-3 sm:text-sm ${
              activeMode === SORT_RATING_HIGH
                ? "bg-brand-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Highest rated
          </button>
          <button
            type="button"
            onClick={() => setSortBy(SORT_RATING_LOW)}
            className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-medium transition sm:flex-none sm:px-3 sm:text-sm ${
              activeMode === SORT_RATING_LOW
                ? "bg-brand-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Lowest rated
          </button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sortedDrinks.map((drink) => (
          <DrinkCard
            key={drink.id}
            drink={{
              ...drink,
              image: drink.image || idbImages[drink.id] || null,
            }}
            savedView
            onRatingChange={(r) => onUpdate(drink.id, { rating: r })}
            onNotesChange={(notes) => onUpdate(drink.id, { notes })}
            onRemove={() => onRemove(drink.id)}
          />
        ))}
      </div>
    </div>
  );
}
