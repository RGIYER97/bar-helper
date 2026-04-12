# Bar Help

A small web app that suggests cocktails from what you have on hand. Add ingredients as tags, search a public recipe database, or ask an LLM for tailored recommendations. Save favorites, rate them, and keep notes — all stored in your browser.

## Features

- **Ingredient tags** — type to add chips; optional autocomplete; persist your list in `localStorage`.
- **Find Drinks** — queries [TheCocktailDB](https://www.thecocktaildb.com/) and only shows drinks you can make from **subsets** of your ingredients (not every tag required in one recipe).
- **Get Creative (AI)** — sends your ingredients (and an optional “mood” prompt) to the Google Gemini API; returns several ranked drink ideas with recipes. Models are tried in order with fallbacks if one is rate-limited or unavailable.
- **US fl oz** — ingredient measures and instruction text for database drinks are shown in fluid ounces where a volume unit is detected.
- **Saved drinks** — same card layout as Discover (image, ingredients, instructions), plus star rating, tasting notes, remove, and sort by recency or rating.

## Tech stack

- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- `localStorage` via a small hook (ingredients, saved drinks, sort preference)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20+ recommended for latest tooling)
- A **Gemini API key** (free tier at [Google AI Studio](https://aistudio.google.com/apikey)) — required only for the AI button

## Setup

```bash
cd "bar help"
npm install
cp .env.example .env
```

Edit `.env` and set `VITE_GEMINI_API_KEY` to your key. Do not commit `.env` (it is listed in `.gitignore`).

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start dev server (Vite)  |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |

## Environment variables

| Variable               | Required for AI | Description        |
| ---------------------- | --------------- | ------------------ |
| `VITE_GEMINI_API_KEY`  | Yes             | Google Gemini API key |

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
    api.js                # CocktailDB + Gemini
    formatMeasureToOz.js  # cl/ml → oz helpers
```

## License

Private project; use and modify as you like for personal use.
