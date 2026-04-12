import StarRating from "./StarRating";
import { formatMeasureToOz, formatInstructionTextToOz } from "../utils/formatMeasureToOz";

export default function DrinkCard({
  drink,
  onSave,
  isSaved,
  savedView = false,
  onRatingChange,
  onNotesChange,
  onRemove,
}) {
  const isCreative = drink.source === "gemini";
  const ingredients = drink.ingredients ?? [];

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 transition hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/5">
      {drink.image ? (
        <img
          src={drink.image}
          alt={drink.name}
          className="h-48 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-48 items-center justify-center bg-gradient-to-br from-brand-500/20 to-purple-900/30">
          <span className="text-5xl">✨</span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-white">{drink.name}</h3>
          {isCreative && (
            <span className="shrink-0 rounded-full bg-brand-500/20 px-2 py-0.5 text-xs font-medium text-brand-300">
              AI Created
            </span>
          )}
        </div>

        {drink.tagline && (
          <p className="mb-3 text-sm italic text-gray-400">{drink.tagline}</p>
        )}

        <div className="mb-3">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Ingredients
          </h4>
          <ul className="space-y-0.5 text-sm text-gray-300">
            {ingredients.map((ing, i) => (
              <li key={i}>
                {ing.measure && (
                  <span className="text-brand-400">
                    {formatMeasureToOz(ing.measure)}{" "}
                  </span>
                )}
                {ing.name}
              </li>
            ))}
          </ul>
        </div>

        {drink.glass && (
          <p className="mb-3 text-xs text-gray-500">
            Serve in: <span className="text-gray-400">{drink.glass}</span>
          </p>
        )}

        <div className="mb-4">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Instructions
          </h4>
          <p className="text-sm leading-relaxed text-gray-300">
            {drink.source === "cocktaildb"
              ? formatInstructionTextToOz(drink.instructions ?? "")
              : drink.instructions ?? ""}
          </p>
        </div>

        <div className="mt-auto">
          {savedView ? (
            <div className="space-y-3 border-t border-gray-800 pt-4">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Your rating
                </h4>
                <StarRating
                  rating={drink.rating || 0}
                  onChange={(r) => onRatingChange?.(r)}
                />
              </div>
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tasting notes
                </h4>
                <textarea
                  value={drink.notes || ""}
                  onChange={(e) => onNotesChange?.(e.target.value)}
                  placeholder="How was it? Jot down your thoughts…"
                  rows={2}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
              <button
                type="button"
                onClick={() => onRemove?.()}
                className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
              >
                Remove from saved
              </button>
            </div>
          ) : !isSaved ? (
            <button
              type="button"
              onClick={() => onSave(drink)}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500 active:scale-[0.98]"
            >
              Save Drink
            </button>
          ) : (
            <span className="block w-full rounded-xl bg-gray-800 px-4 py-2.5 text-center text-sm font-medium text-gray-400">
              Already Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
