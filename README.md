# Bar Help

**Repository:** [github.com/RGIYER97/bar-helper](https://github.com/RGIYER97/bar-helper)

A small web app that suggests cocktails from what you have on hand. Add ingredients as tags, search a public recipe database, or ask an LLM for tailored recommendations. Save favorites, rate them, and keep notes — all stored in your browser.

## Cocktail sources

- **TheCocktailDB** — primary recipe catalog for the **Find Drinks** flow.
- **Google Gemini API** — AI-generated recipe suggestions for **Get Creative (AI)**.
- **OpenRouter** (`black-forest-labs/flux.2-klein-4b`) — optional **image generation only** for AI drinks.

## Features

- **Ingredient tags** — type to add chips; optional autocomplete; persist your list in `localStorage`.
- **Find Drinks** — queries [TheCocktailDB](https://www.thecocktaildb.com/) and only shows drinks you can make from **subsets** of your ingredients (not every tag required in one recipe).
- **Get Creative (AI)** — sends your ingredients (and an optional “mood” prompt) to the **Google Gemini API** for recipe JSON. Several Gemini models are tried in order with fallbacks if one is rate-limited or unavailable.
- **AI drink images** (optional) — **OpenRouter** calls **`black-forest-labs/flux.2-klein-4b`** (FLUX.2 [klein] 4B) via chat completions. Images are cached in **IndexedDB** (plus in-memory) and **concurrent requests for the same drink are deduplicated** so parallel cards do not double-bill the image API.
- **US fl oz** — ingredient measures and instruction text for database drinks are shown in fluid ounces where a volume unit is detected.
- **Saved drinks** — same card layout as Discover (image, ingredients, instructions), plus star rating, tasting notes, remove, and sort by recency or rating. Large AI images are stored in **IndexedDB**, not inside the `localStorage` JSON, so saves stay under quota and persist across sessions.

## Tech stack

- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- `localStorage` via a small hook (ingredients, saved drinks, sort preference)
- **IndexedDB** for AI-generated image URLs / data URLs (`src/utils/imageCache.js`)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20+ recommended for latest tooling)
- A **Gemini API key** (free tier at [Google AI Studio](https://aistudio.google.com/apikey)) — required for AI drink recipes
- An **OpenRouter API key** ([openrouter.ai/keys](https://openrouter.ai/keys)) — optional, used for AI drink images

## Setup

```bash
cd "bar help"
npm install
cp .env.example .env
```

Edit `.env` and set `VITE_GEMINI_API_KEY`.  
Optionally set `VITE_OPENROUTER_API_KEY` to enable AI-generated drink images.

**Do not commit `.env`.** It is listed in `.gitignore` and must stay local-only. Keys in `VITE_*` variables are embedded in the client bundle at build time — treat them like public credentials and restrict keys in each provider’s dashboard (HTTP referrer, usage caps, etc.).

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start dev server (Vite)  |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test:e2e` | Playwright: persistence test (tiny PNG in IndexedDB + saved drink in `localStorage`; reload + preview server restart). Requires port **5173** free. |

After `npm install`, run `npx playwright install chromium` once (or the first `test:e2e` will prompt) to download the browser.

Dev and preview both use **port 5173** (`vite.config.js`) so `localStorage` for the app shares the same origin whether you run `dev` or `preview`.

## Environment variables

| Variable               | Required for AI | Description        |
| ---------------------- | --------------- | ------------------ |
| `VITE_GEMINI_API_KEY`  | Yes (for AI recipes) | Google Gemini API key |
| `VITE_OPENROUTER_API_KEY` | No (for AI images) | OpenRouter API key; image model `black-forest-labs/flux.2-klein-4b` |

The CocktailDB calls use their public JSON API and need no key.

## Project layout (high level)

```
src/
  App.jsx                 # Tabs, ingredient state, search + AI handlers
  components/
    DrinkCard.jsx         # Shared card (Discover + Saved)
    IngredientInput.jsx
    SavedDrinks.jsx       # Sort + grid of saved cards
    StarRating.jsx
  hooks/useLocalStorage.js
  utils/
    api.js                # CocktailDB, Gemini recipes, OpenRouter images
    imageCache.js         # IndexedDB + memory cache + in-flight dedupe
    formatMeasureToOz.js  # cl/ml → oz helpers
```

## License

Private project; use and modify as you like for personal use.
