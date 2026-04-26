# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

**Install & run dev server:**
```bash
npm install
cp .env.example .env
# Edit .env and set VITE_GEMINI_API_KEY (required for AI features)
# Optionally set VITE_OPENROUTER_API_KEY for AI image generation
npm run dev
```

**Build for production:**
```bash
npm run build          # Output → dist/
npm run preview        # Serve built app locally (port 5173)
```

**Run tests:**
```bash
npm run test:e2e       # Playwright E2E test (requires built app + preview)
# First-time setup: npx playwright install chromium
```

## Project Overview

Bar Help is a React + Vite web app that suggests cocktails based on available ingredients. It combines four data sources:

1. **TheCocktailDB** — public API of 600+ cocktails (no auth)
2. **IBA Classics** — 77 official International Bartenders Association recipes bundled as `src/data/iba-cocktails.json` (no network call, works offline)
3. **Google Gemini API** — generates custom cocktail recipes with mood-based filtering
4. **OpenRouter (optional)** — generates drink images via FLUX.2 klein text-to-image model

Users add ingredients as tags, see matching drinks, save favorites with ratings/notes. All data persists in `localStorage` and `IndexedDB`.

## Architecture Highlights

### App Data Flow

```
App.jsx (state hub)
├── ingredients    → useLocalStorage (persist in browser)
├── results        → useState (CocktailDB exact matches)
├── ibaResults     → useState (IBA exact matches, deduped against results)
├── almostDrinks   → useState (drinks missing exactly 1 ingredient, both sources)
├── creativeDrinks → useState (Gemini AI recipes)
├── savedDrinks    → useLocalStorage (with IndexedDB images)
├── shoppingList   → useMemo over almostDrinks (top ingredients to buy)
│
└── Handlers:
    ├── handleSearch() → fetchDrinksByIngredients() + fetchIbaCocktails() in parallel
    │                    each returns { exact, almost }; merged and deduped by name
    ├── handleCreative() → fetchCreativeDrinks() → Gemini multi-model fallback
    └── saveDrink() → move base64 images to IndexedDB (quota safety)
```

Components are presentation-only; all logic flows through App.jsx props and useState/useLocalStorage.

### Ingredient Matching (Non-Obvious)

`src/utils/api.js` has sophisticated fuzzy matching:

- **PANTRY_ALWAYS** — `ice`, `water`, `salt`, `sugar` assumed available (not required in user list)
- **DISTINGUISHING_SECOND_WORD** — "orange vodka" ≠ "vodka"; requires base spirit match or exact ingredient
- **wholePhrase()** — word-boundary regex matching, case-insensitive, space-normalized
- **userCoversDrinkIngredient()** — checks if a drink ingredient can be satisfied by user's list

Flow: Query CocktailDB per ingredient → merge candidates → rank by hit count → fetch full recipes → split into `exact` (all ingredients covered) and `almost` (exactly 1 missing). IBA uses the same split on its local dataset. Both sources contribute to the "Almost There" and "What to Buy" features.

**`getMissingIngredients(drink, userListNorm)`** — returns the names of uncovered ingredients. Used to classify almost-drinks and populate the shopping list.

### Gemini API Multi-Model Fallback

If rate-limited (429) or unavailable (404), automatically tries next model:

```
gemini-2.5-flash → gemini-3.1-flash-lite-preview → gemini-2.5-flash-lite
→ gemini-3-flash-preview → gemma-4-e2b-it (smallest)
```

Extracts retry seconds from 429 response body. Handles both `responseSchema` (Gemini 2.0+) and loose JSON parsing fallback.

### Three-Tier Image Cache

AI-generated drink images are expensive; cached in three layers to prevent redundant API calls:

1. **Memory Map** — current session only (fastest)
2. **IndexedDB** — persists across browser sessions
3. **In-flight dedup** — concurrent requests for same drink share one Promise

Cache key: `{lowercased drink name}|{sorted ingredient names}`. Allows large base64 data URLs to live outside `localStorage` (quota safety).

**Migration on app boot:** If any saved drinks contain `data:image/` URLs, they're moved from localStorage to IndexedDB in `App.jsx` useEffect.

### Volume Conversion

`src/utils/formatMeasureToOz.js` converts all measures to US fluid ounces for consistency:

- Parses mixed numbers: `1 1/2 oz`, fractions `1/4 oz`, decimals `1.5 oz`
- Converts units: `ml`, `cl`, `liter`, `oz`, `tbsp`, `tsp`, `shot`, `pint`, `cup`
- Snaps to nearest ¼ oz and formats as bartender fractions: `4 cl` → `1 1/4 oz`, `6 cl` → `2 oz`
- Handles ranges: `1-2 oz` → `1 oz – 2 oz`
- Transforms instruction text in-place: "add 30 ml rum" → "add 1 oz rum"
- Returns `null` for near-zero amounts (< ⅛ oz); caller keeps the original string

Applied to ingredient measures and free-form instruction text for CocktailDB and IBA sources.

## Key File Purposes

| File | Purpose |
|------|---------|
| `App.jsx` | Root component; manages all state. `handleSearch` fans out to both sources in parallel, splits results into exact/almost, deduplicates, and derives `shoppingList` via `useMemo`. |
| `src/utils/api.js` | Both fetch functions return `{ exact, almost }`. `getMissingIngredients` powers the almost/shopping-list logic. Also handles Gemini and OpenRouter. |
| `src/data/iba-cocktails.json` | Bundled IBA official cocktail dataset (77 recipes, sourced from teijo/iba-cocktails on GitHub). All measures in cl; converted to oz at render time by DrinkCard. |
| `src/utils/imageCache.js` | 3-tier image cache: memory, IndexedDB, in-flight dedup. Key function: `drinkImageKey()` for stable cache lookup. |
| `src/utils/formatMeasureToOz.js` | Volume unit parsing and conversion; handles mixed numbers, ranges, and instruction text. |
| `src/hooks/useLocalStorage.js` | Custom hook; syncs state to `localStorage` on every change. Gracefully handles quota exceeded. |
| `src/components/DrinkCard.jsx` | Shared card layout for both Discover and Saved views. Shows image, ingredients, instructions, and optional rating/notes. |
| `src/components/SavedDrinks.jsx` | Grid with sorting buttons (recent, oldest, rating high/low). Fetches IndexedDB images asynchronously. |
| `e2e/persistence.spec.js` | Playwright test: saves drink with IndexedDB image, reloads page, kills/restarts preview server, confirms data persists. |

## Environment & API Keys

Store in `.env` (Git-ignored):

```
VITE_GEMINI_API_KEY=your_key_here          # Required for AI recipes
VITE_OPENROUTER_API_KEY=your_key_here      # Optional for AI images
```

Both are embedded in the **client bundle at build time** — treat as public credentials. Use provider dashboards to restrict by IP, referrer, or usage caps.

## Development Notes

### Adding a Cocktail Data Source

1. Implement fetch function in `src/utils/api.js`; return `{ exact, almost }` where `almost` drinks include `missingIngredient: string`
2. Normalize each drink to: `{ id, name, image, ingredients: [{ name, measure }], instructions, source }`
3. Add exact/almost state in `App.jsx`; merge almost into `almostDrinks` with dedup; `shoppingList` updates automatically via `useMemo`
4. DrinkCard renders the missing-ingredient banner and highlight automatically when `drink.missingIngredient` is set

### Debugging Ingredient Matching

- Use browser DevTools to inspect `ingredients` state and drink objects
- Test `userCoversDrinkIngredient(neededIngredient, userList)` in console
- Check `PANTRY_ALWAYS` and `DISTINGUISHING_SECOND_WORD` sets if edge cases fail

### Adding New Sorting Options

1. Add constant to `SavedDrinks.jsx` (e.g., `SORT_CATEGORY = "category"`)
2. Implement sort function in `useMemo` (uses `drinks`, `sortBy`)
3. Add button in sort bar to set new `sortBy` value via `setSortBy()`

### Handling Quota Issues

Large images automatically migrate to IndexedDB in `App.jsx` on mount. If you add new types of data:

- Keep JSON payloads in `localStorage` (small, cached)
- Move images/blobs to `IndexedDB` (higher limits, async)
- Graceful fallback: `useLocalStorage.js` silently ignores quota exceeded errors

### Testing Image Caching

E2E test manually:

```bash
npm run build
npm run preview  # in one terminal
npm run test:e2e # in another
```

Test creates IndexedDB entry, reloads page, verifies image persists, kills/restarts server, verifies again.

## Tech Stack Summary

- **React 18.3** — component framework
- **Vite 5** — build tool, dev server (port 5173)
- **Tailwind CSS 3** — styling (brand color = magenta)
- **Playwright** — E2E testing
- **IndexedDB** — persistent image cache
- **localStorage** — state persistence

No Redux, Context API, or external state management—App.jsx is the single source of truth.

## Non-Obvious Implementation Details

1. **Creative Drink IDs** — Format `creative-{timestamp}-{index}` to avoid collisions with DB drinks
2. **Saved Drink Records** — Include `rating`, `notes`, `savedAt` (timestamp), but image lives in IndexedDB keyed by `drinkImageKey()`
3. **Error Recovery** — Graceful fallback for missing Gemini models, JSON parse failures, quota exceeded; never hard fails
4. **Lazy Images** — DrinkCard uses `loading="lazy"` on img elements
5. **Mood Prompt** — Entirely optional; if blank, Gemini recommends based on ingredient diversity alone
6. **Measure Fallback** — If conversion fails, original measure is shown unchanged
7. **Match Count** — CocktailDB results ranked by how many of user's ingredients appear in the drink (higher = better match)
8. **Almost/Shopping dedup** — `almostSeen` set is seeded with all exact match names before merging almost drinks, so a drink can't appear in both sections
9. **`missingIngredient` is a single string** — DrinkCard highlights it by lowercased exact match against each ingredient's `name` field; the IBA `label || ingredient` naming ensures the right row lights up

## Common Pitfalls

- **API Keys in localStorage** — Never store API keys in `localStorage` or IndexedDB; keep in `.env` (client-side embedding is intentional for Vite)
- **Ingredient Matching Complexity** — The fuzzy matching is intentional; "vodka" matches "grey goose", "rum" matches "bacardi". Don't oversimplify.
- **Almost drinks are capped at 18** — to avoid overwhelming the UI when users have few ingredients. Raise the `slice(0, 18)` in `handleSearch` if needed.
- **Shopping list groups by lowercased ingredient name** — "Campari" and "campari" merge correctly, but "Sweet red vermouth" and "Vermouth" remain separate entries since they're distinct strings from the dataset.
- **Image Cache Invalidation** — Cache key is `{name}|{ingredients}`; changing an ingredient name will create a new cache entry (intended behavior)
- **Concurrent Image Fetches** — If multiple cards request images for the same drink, the in-flight dedup ensures one API call shared by all (don't bypass this)
- **IndexedDB Initialization** — openDB() lazily opens on first use; safe to call multiple times (uses dbPromise singleton)
