# Bar Help

**Repository:** [github.com/RGIYER97/bar-helper](https://github.com/RGIYER97/bar-helper)

A web app that suggests cocktails from what you have on hand. Add ingredients as tags, search multiple recipe databases, or ask an LLM for tailored recommendations. Save favorites, rate them, and keep notes — all stored in your browser.

## Cocktail sources

- **TheCocktailDB** — crowd-sourced catalog of 600+ recipes, queried by ingredient.
- **IBA Classics** — 77 official International Bartenders Association recipes, bundled locally (no network call).
- **Google Gemini API** — AI-generated recipe suggestions for **Get Creative (AI)**.
- **OpenRouter** (`black-forest-labs/flux.2-klein-4b`) — optional image generation for AI drinks.

## Features

- **Ingredient tags** — type to add chips; persist across sessions in `localStorage`.
- **Find Drinks** — queries TheCocktailDB and IBA simultaneously, showing only drinks you can make from subsets of your ingredients. All measures displayed in US fluid ounces, snapped to the nearest ¼ oz (e.g. `4 cl gin` → `1 1/4 oz`).
- **IBA Classics** — shown as a separate section; authoritative spec recipes for classics like Negroni, Margarita, and Old Fashioned.
- **Almost There** — drinks from both databases where you're missing exactly one ingredient, with the missing item highlighted on the card.
- **What to Buy** — ranks every single missing ingredient by how many drinks it would unlock, so you can see at a glance which one purchase opens the most options.
- **Get Creative (AI)** — sends your ingredients and an optional mood prompt to Google Gemini for custom recipe JSON. Multiple Gemini models are tried in order with automatic fallback if one is rate-limited.
- **AI drink images** (optional) — generated via OpenRouter/FLUX. Cached in IndexedDB plus in-memory; concurrent requests for the same drink are deduplicated to avoid double-billing.
- **Saved drinks** — star rating, tasting notes, remove, and sort by recency or rating. AI images live in IndexedDB rather than `localStorage` to stay under quota.

## Tech stack

- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- `localStorage` via a small custom hook (ingredients, saved drinks, sort preference)
- **IndexedDB** for AI-generated images (`src/utils/imageCache.js`)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20+ recommended)
- A **Gemini API key** (free tier at [Google AI Studio](https://aistudio.google.com/apikey)) — required for AI recipes
- An **OpenRouter API key** ([openrouter.ai/keys](https://openrouter.ai/keys)) — optional, for AI drink images

## Setup

```bash
cd "bar help"
npm install
cp .env.example .env
```

Edit `.env` and set `VITE_GEMINI_API_KEY`. Optionally set `VITE_OPENROUTER_API_KEY` to enable AI-generated drink images.

**Do not commit `.env`.** Keys in `VITE_*` variables are embedded in the client bundle at build time — treat them like public credentials and restrict them in each provider's dashboard (HTTP referrer, usage caps, etc.).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server (Vite, port 5173) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally (port 5173) |
| `npm run test:e2e` | Playwright persistence test — requires a running `preview` server on port 5173. Run `npx playwright install chromium` once first. |

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_GEMINI_API_KEY` | Yes (AI recipes) | Google Gemini API key |
| `VITE_OPENROUTER_API_KEY` | No (AI images) | OpenRouter key; uses `black-forest-labs/flux.2-klein-4b` |

TheCocktailDB and IBA use no keys — TheCocktailDB is a public API and IBA data is bundled.

## Project layout

```
src/
  App.jsx                 # All state; search fans out to CocktailDB + IBA in parallel
  data/
    iba-cocktails.json    # Bundled IBA official recipes (77 drinks, measures in cl)
  components/
    DrinkCard.jsx         # Shared card (Discover + Saved + Almost There)
    IngredientInput.jsx
    SavedDrinks.jsx       # Sort + grid of saved cards
    StarRating.jsx
  hooks/useLocalStorage.js
  utils/
    api.js                # CocktailDB + IBA fetching, ingredient matching, Gemini, OpenRouter
    imageCache.js         # IndexedDB + memory cache + in-flight dedupe
    formatMeasureToOz.js  # Unit conversion; snaps to nearest 1/4 oz, formats as fractions
```

## License

Private project; use and modify as you like for personal use.
