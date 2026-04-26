import { getCachedImage, setCachedImage, dedupeImageFetch } from "./imageCache.js";
import IBA_COCKTAILS from "../data/iba-cocktails.json";

const COCKTAIL_DB_BASE = "https://www.thecocktaildb.com/api/json/v1/1";

/** TheCocktailDB returns `drinks` as an array, null, or occasionally a single object. */
function coerceDrinksArray(drinks) {
  if (drinks == null) return [];
  if (Array.isArray(drinks)) return drinks;
  if (typeof drinks === "object" && drinks.idDrink) return [drinks];
  return [];
}

/** Assumed on hand — not required in the user's list. */
const PANTRY_ALWAYS = new Set([
  "ice",
  "water",
  "salt",
  "sugar",
]);

/**
 * If the drink name is "A B" and the user only supplied "A", we still allow it when B is
 * something like "juice" but not when B is another spirit/product (e.g. "orange bitters").
 */
const DISTINGUISHING_SECOND_WORD = new Set([
  "bitters",
  "vermouth",
  "liqueur",
  "brandy",
  "wine",
  "schnapps",
  "vodka",
  "gin",
  "rum",
  "tequila",
  "whiskey",
  "whisky",
  "bourbon",
  "scotch",
  "cognac",
  "absinthe",
  "mezcal",
  "pisco",
  "sake",
  "beer",
  "cider",
  "extract",
  "aperitif",
  "cordial",
]);

function normIng(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `needle` appears in `hay` as a whole phrase (not a substring of one word). */
function wholePhrase(hay, needle) {
  const h = normIng(hay);
  const n = normIng(needle);
  if (!n) return false;
  return new RegExp(`(^|\\s)${escapeRe(n)}(\\s|$)`).test(h);
}

/**
 * True if the user can supply this cocktail ingredient from their list (names are fuzzy).
 */
function userCoversDrinkIngredient(neededRaw, userListNorm) {
  const needed = normIng(neededRaw);
  if (!needed || PANTRY_ALWAYS.has(needed)) return true;

  const needToks = needed.split(/\s+/);

  for (const u of userListNorm) {
    if (!u) continue;
    if (needed === u) return true;

    if (wholePhrase(needed, u)) {
      if (u === needToks[0] && needToks.length > 1) {
        const second = needToks[1];
        if (DISTINGUISHING_SECOND_WORD.has(second)) {
          if (userListNorm.includes(needed)) return true;
          if (userListNorm.some((x) => x === second)) return true;
          continue;
        }
      }
      return true;
    }

    if (wholePhrase(u, needed)) return true;
  }

  return false;
}

function drinkOnlyUsesUserIngredients(drink, userListNorm) {
  return drink.ingredients.every((row) =>
    userCoversDrinkIngredient(row.name, userListNorm),
  );
}

/** Returns ingredient names the user cannot cover. */
function getMissingIngredients(drink, userListNorm) {
  return drink.ingredients
    .filter((row) => !userCoversDrinkIngredient(row.name, userListNorm))
    .map((row) => row.name);
}

/**
 * Fetch drinks from TheCocktailDB the user can make with only their ingredients.
 * The API only filters by one ingredient at a time, so we fan-out, merge candidates,
 * fetch full recipes, then keep drinks whose full ingredient list is covered by the user.
 */
export async function fetchDrinksByIngredients(ingredients) {
  if (!ingredients.length) return { exact: [], almost: [] };

  const userListNorm = [...new Set(ingredients.map(normIng).filter(Boolean))];

  const fetches = ingredients.map((ing) =>
    fetch(`${COCKTAIL_DB_BASE}/filter.php?i=${encodeURIComponent(ing)}`)
      .then((r) => r.json())
      .then((data) => coerceDrinksArray(data?.drinks))
      .catch(() => []),
  );

  const results = await Promise.all(fetches);

  const hitCount = {};
  const drinkMap = {};

  results.forEach((drinks) => {
    drinks.forEach((d) => {
      hitCount[d.idDrink] = (hitCount[d.idDrink] || 0) + 1;
      drinkMap[d.idDrink] = d;
    });
  });

  const ranked = Object.entries(hitCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([id, matchCount]) => ({ ...drinkMap[id], matchCount }));

  const detailed = await Promise.all(
    ranked.map((d) =>
      fetch(`${COCKTAIL_DB_BASE}/lookup.php?i=${d.idDrink}`)
        .then((r) => r.json())
        .then((data) => {
          const list = coerceDrinksArray(data?.drinks);
          const full = list[0];
          if (!full) return null;
          return normalizeCocktailDB(full, d.matchCount);
        })
        .catch(() => null),
    ),
  );

  const candidates = detailed.filter(Boolean);
  const exact = candidates.filter((d) => drinkOnlyUsesUserIngredients(d, userListNorm));
  const almost = candidates
    .filter((d) => !drinkOnlyUsesUserIngredients(d, userListNorm))
    .map((d) => {
      const missing = getMissingIngredients(d, userListNorm);
      return missing.length === 1 ? { ...d, missingIngredient: missing[0] } : null;
    })
    .filter(Boolean);

  return { exact, almost };
}

function normalizeCocktailDB(d, matchCount) {
  const ingredients = [];
  for (let i = 1; i <= 15; i++) {
    const ing = d[`strIngredient${i}`];
    const measure = d[`strMeasure${i}`];
    if (ing) ingredients.push({ name: ing.trim(), measure: measure?.trim() || "" });
  }

  return {
    id: d.idDrink,
    name: d.strDrink,
    image: d.strDrinkThumb,
    instructions: d.strInstructions,
    ingredients,
    matchCount,
    source: "cocktaildb",
  };
}

/**
 * Split an IBA "special" free-text ingredient into {name, measure}.
 * e.g. "2 dashes Angostura Bitters" → { measure: "2 dashes", name: "Angostura Bitters" }
 *      "6 Mint sprigs"               → { measure: "6", name: "Mint sprigs" }
 *      "Soda water"                  → { measure: "", name: "Soda water" }
 */
function parseIbaSpecial(s) {
  const m = s.match(
    /^(\d+(?:[/.]\d+)?)\s+(?:(dashes?|sprigs?|teaspoons?|tablespoons?|shots?|drops?|cubes?|slices?|pieces?|bar\s+spoons?|ml|cl)\s+)?(.+)$/i,
  );
  if (m) {
    const quantity = m[1];
    const unit = m[2] ? m[2].trim() : "";
    return { measure: unit ? `${quantity} ${unit}` : quantity, name: m[3].trim() };
  }
  return { measure: "", name: s };
}

function normalizeIba(d, matchCount) {
  const ingredients = d.ingredients.map((ing) => {
    if (ing.special != null) return parseIbaSpecial(ing.special);
    const measure = `${ing.amount} ${ing.unit}`;
    return { name: ing.label || ing.ingredient, measure };
  });

  return {
    id: `iba-${d.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: d.name,
    image: null,
    instructions: d.preparation,
    ingredients,
    glass: d.glass ?? null,
    matchCount,
    source: "iba",
  };
}

/**
 * Filter IBA official cocktails by the user's ingredient list.
 * Returns drinks whose full ingredient list is covered, ranked by match count.
 */
export function fetchIbaCocktails(ingredients) {
  if (!ingredients.length) return { exact: [], almost: [] };

  const userListNorm = [...new Set(ingredients.map(normIng).filter(Boolean))];

  const normalized = IBA_COCKTAILS.map((d) => {
    const norm = normalizeIba(d, 0);
    const matchCount = norm.ingredients.filter((row) =>
      userListNorm.some(
        (u) => wholePhrase(row.name, u) || wholePhrase(u, row.name),
      ),
    ).length;
    return { ...norm, matchCount };
  });

  const exact = normalized
    .filter((d) => drinkOnlyUsesUserIngredients(d, userListNorm))
    .sort((a, b) => b.matchCount - a.matchCount);

  const almost = normalized
    .filter((d) => !drinkOnlyUsesUserIngredients(d, userListNorm))
    .map((d) => {
      const missing = getMissingIngredients(d, userListNorm);
      return missing.length === 1 ? { ...d, missingIngredient: missing[0] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.matchCount - a.matchCount);

  return { exact, almost };
}

const GEMINI_SYSTEM_PROMPT = `You are a world-class mixologist. The user will list the ingredients they have on hand and optionally describe the mood or type of drinks they are looking for. Your job is to recommend the BEST drinks that can be made from a SUBSET of those ingredients — you do NOT need to use every ingredient in every drink.

Guidelines:
- Return 3–5 drinks (use your judgment — fewer if the ingredient set is narrow, more if there is variety).
- If the user describes a mood or preference (e.g. 'something refreshing', 'tiki vibes', 'strong and spirit-forward'), prioritize drinks that match that vibe. Otherwise, vary flavor profiles on your own.
- Rank them by how delicious/impressive they are — put the best one first.
- You may assume the user also has ice, water, and simple garnishes (salt/sugar rims, common fruit wedges).
- Each drink should use only ingredients from the provided list (plus the assumed basics above).
- Use US fluid ounces (oz) for all liquid measures.
- Keep each instructions field under 350 characters.
- In every string value avoid double-quote characters; use single quotes if needed.`;

/** Forces API-level structured JSON so strings are properly escaped. */
const GEMINI_RECIPE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    drinks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          tagline: { type: "STRING" },
          ingredients: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                measure: { type: "STRING" },
              },
              required: ["name", "measure"],
            },
          },
          instructions: { type: "STRING" },
          glass: { type: "STRING" },
        },
        required: ["name", "tagline", "ingredients", "instructions", "glass"],
      },
    },
  },
  required: ["drinks"],
};

function stripMarkdownJsonFence(text) {
  let s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```\s*$/im.exec(s);
  if (fence) s = fence[1].trim();
  return s;
}

/** Extract the outermost JSON structure (object or array) via brace/bracket matching. */
function extractJson(text) {
  const s = stripMarkdownJsonFence(text);
  try {
    return JSON.parse(s);
  } catch {
    /* try substring extraction */
  }

  const openChars = { "{": "}", "[": "]" };
  let startIdx = -1;
  let closeChar = null;
  for (let i = 0; i < s.length; i++) {
    if (openChars[s[i]]) {
      startIdx = i;
      closeChar = openChars[s[i]];
      break;
    }
  }
  if (startIdx < 0) throw new Error("No JSON in model response");

  let depth = 0;
  let inString = false;
  let escape = false;
  const openChar = s[startIdx];
  for (let i = startIdx; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(startIdx, i + 1));
    }
  }

  throw new Error("Incomplete JSON in model response — try again.");
}

/** Given the parsed payload, pull out the drinks array (handles both wrapper and bare array). */
function extractDrinksArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.drinks)) return parsed.drinks;
  if (parsed && typeof parsed === "object" && parsed.name) return [parsed];
  throw new Error("Unexpected response shape from model");
}

function normalizeRecipePayload(recipe) {
  if (!recipe || typeof recipe !== "object") {
    throw new Error("Invalid recipe shape from model");
  }
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((row) => ({
        name: String(row?.name ?? "").trim(),
        measure: String(row?.measure ?? "").trim(),
      }))
    : [];
  return {
    name: String(recipe.name ?? "Custom drink").trim() || "Custom drink",
    tagline: String(recipe.tagline ?? "").trim(),
    instructions: String(recipe.instructions ?? "").trim(),
    glass: String(recipe.glass ?? "").trim(),
    ingredients,
  };
}

/**
 * Models to try in order — skips any that return 429 (rate-limited) or 404 (unavailable).
 * Gemma 3 1B is not available on the Gemini API; gemma-4-e2b-it (2B) is the smallest
 * Gemma model the API supports and is used as the last-resort fallback.
 */
const GEMINI_MODELS = [
  "gemini-2.5-flash",          // Gemini 2.5 Flash
  "gemini-3.1-flash-lite-preview", // Gemini 3.1 Flash Lite
  "gemini-2.5-flash-lite",     // Gemini 2.5 Flash Lite
  "gemini-3-flash-preview",    // Gemini 3 Flash
  "gemma-4-e2b-it",            // Gemma 4 2B (smallest available; Gemma 3 1B not on API)
];

function extractRetrySeconds(errorBody) {
  try {
    const json = typeof errorBody === "string" ? JSON.parse(errorBody) : errorBody;
    const delay = json?.error?.details?.find((d) => d.retryDelay)?.retryDelay;
    if (delay) return parseInt(delay, 10);
  } catch {
    /* ignore */
  }
  return null;
}

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
/** FLUX.2 [klein] 4B via OpenRouter — same model family, unified billing/key. */
const OPENROUTER_FLUX_KLEIN_MODEL = "black-forest-labs/flux.2-klein-4b";

/**
 * Build a descriptive text-to-image prompt for a cocktail.
 * FLUX.2 [klein] responds best to scene-first prose describing what to show.
 * @see https://docs.bfl.ml/guides/prompting_guide_flux2_klein.md
 */
function buildFluxDrinkPrompt(recipe) {
  const glass = recipe.glass || "a classic cocktail glass";
  const ingLine = recipe.ingredients
    .map((row) => [row.measure, row.name].filter(Boolean).join(" ").trim())
    .filter(Boolean)
    .join(", ");
  return [
    `A professional bar photograph of a perfectly crafted cocktail called '${recipe.name}',`,
    `served in ${glass}.`,
    ingLine ? `The drink contains ${ingLine}.` : "",
    `Studio bar lighting, shallow depth of field, dark moody background, bokeh, photorealistic.`,
    `No people, no text, no labels, no logos. Shot on 50mm lens.`,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1800);
}

function extractOpenRouterImageUrl(message) {
  const images = message?.images;
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    const direct = first?.image_url?.url ?? first?.imageUrl?.url;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }

  // Fallback shape some providers return via OpenAI-style content parts.
  const content = message?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const maybeUrl =
        part?.image_url?.url ??
        part?.imageUrl?.url ??
        part?.url ??
        part?.source?.url;
      if (typeof maybeUrl === "string" && maybeUrl.trim()) return maybeUrl.trim();
    }
  }

  // Last resort: extract inline data URL from text payload.
  const contentText = typeof content === "string" ? content : "";
  const m = contentText.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/);
  if (m && m[0]) return m[0].replace(/\s+/g, "");

  return null;
}

/**
 * Generate one cocktail image via OpenRouter (FLUX.2 [klein] 4B).
 * Returns a data URL or HTTPS URL, or null on failure.
 * Responses are typically base64 data URLs — cacheable without expiry issues.
 * @see https://openrouter.ai/docs/guides/overview/multimodal/image-generation
 */
/**
 * Fetch (or return cached) one cocktail image via OpenRouter.
 * Wrapped in dedupeImageFetch so parallel calls for the same drink share one request.
 */
function fetchFluxDrinkImage(openRouterApiKey, recipe) {
  return dedupeImageFetch(recipe, async () => {
    const cached = await getCachedImage(recipe);
    if (cached) return cached;

    const prompt = buildFluxDrinkPrompt(recipe);

    let res;
    try {
      res = await fetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENROUTER_FLUX_KLEIN_MODEL,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image"],
          image_config: { aspect_ratio: "4:3" },
        }),
      });
    } catch {
      return null;
    }

    if (!res.ok) {
      if (import.meta.env.DEV) {
        const body = await res.text().catch(() => "");
        console.warn("[OpenRouter image generation failed]", res.status, body.slice(0, 400));
      }
      return null;
    }

    let data;
    try {
      data = await res.json();
    } catch {
      return null;
    }

    const url = extractOpenRouterImageUrl(data?.choices?.[0]?.message);
    if (!url) return null;

    await setCachedImage(recipe, url);
    return url;
  });
}

export async function fetchCreativeDrinks(ingredients, moodPrompt = "") {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY in your .env file");

  const openRouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY ?? null;

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    const basePayload = {
      system_instruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                `My available ingredients: ${ingredients.join(", ")}.`,
                moodPrompt.trim() ? `\nWhat I'm in the mood for: ${moodPrompt.trim()}` : "",
                `\nRecommend the best drinks I can make.`,
              ].join(""),
            },
          ],
        },
      ],
    };

    const trySchema = async (useResponseSchema) => {
      const generationConfig = {
        temperature: 0.85,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        ...(useResponseSchema ? { responseSchema: GEMINI_RECIPE_RESPONSE_SCHEMA } : {}),
      };
      return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...basePayload, generationConfig }),
        },
      );
    };

    let res = await trySchema(true);
    if (res.status === 400) {
      const errText = await res.text();
      if (/responseSchema|response_schema|schema/i.test(errText)) {
        res = await trySchema(false);
      } else {
        throw new Error(`Gemini API error: ${errText}`);
      }
    }

    if (res.status === 429) {
      const body = await res.text();
      const retrySecs = extractRetrySeconds(body);
      lastError = retrySecs
        ? `Rate limit hit. Try again in ${retrySecs} seconds.`
        : "Rate limit hit on all Gemini models. Try again in a minute.";
      continue;
    }

    if (res.status === 404) {
      lastError = `Model ${model} not found, trying next…`;
      continue;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error: ${err}`);
    }

    const data = await res.json();
    const cand = data.candidates?.[0];
    const finish = cand?.finishReason;
    if (finish && finish !== "STOP" && finish !== "MAX_TOKENS") {
      lastError = `Model stopped (${finish}). Try again or adjust ingredients.`;
      continue;
    }

    const parts = cand?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    if (!text) {
      lastError = "Empty response from the model. Try again.";
      continue;
    }

    let recipes;
    try {
      const parsed = extractJson(text);
      const rawList = extractDrinksArray(parsed);
      recipes = rawList.map(normalizeRecipePayload);
    } catch (e) {
      lastError = e.message || "Could not read the recipe JSON.";
      continue;
    }

    if (!recipes.length) {
      lastError = "Model returned no drinks — try again.";
      continue;
    }

    const batchTs = Date.now();
    const drinks = await Promise.all(
      recipes.map(async (recipe, idx) => {
        const image = openRouterApiKey
          ? await fetchFluxDrinkImage(openRouterApiKey, recipe)
          : null;
        return {
          id: `creative-${batchTs}-${idx}`,
          name: recipe.name,
          tagline: recipe.tagline,
          image,
          instructions: recipe.instructions,
          ingredients: recipe.ingredients,
          glass: recipe.glass,
          matchCount: ingredients.length,
          source: "gemini",
        };
      }),
    );
    return drinks;
  }

  throw new Error(lastError ?? "All Gemini models are currently unavailable.");
}
