/** US fluid ounces in milliliters */
const ML_PER_OZ = 29.5735295625;

/** Volume units → milliliters (per 1 unit of measure) */
const UNIT_TO_ML = {
  ml: 1,
  cl: 10,
  liter: 1000,
  litre: 1000,
  l: 1000,
  oz: ML_PER_OZ,
  ounce: ML_PER_OZ,
  ounces: ML_PER_OZ,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  cup: 236.588,
  cups: 236.588,
  shot: 44.3603,
  shots: 44.3603,
  pint: 473.176,
  pints: 473.176,
};

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Longest keys first so "tablespoons" beats "tablespoon" and "ml" is found before bare "l" issues */
const UNIT_KEYS = Object.keys(UNIT_TO_ML).sort((a, b) => b.length - a.length);

function parseLeadingNumber(str) {
  const s = str.trim();
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)/;
  const frac = /^(\d+)\s*\/\s*(\d+)/;
  const dec = /^(\d+[.,]?\d*)/;

  let m = s.match(mixed);
  if (m) {
    const v = Number(m[1]) + Number(m[2]) / Number(m[3]);
    return { value: v, rest: s.slice(m[0].length).trim() };
  }
  m = s.match(frac);
  if (m) {
    const v = Number(m[1]) / Number(m[2]);
    return { value: v, rest: s.slice(m[0].length).trim() };
  }
  m = s.match(dec);
  if (m) {
    const v = parseFloat(m[1].replace(",", "."));
    return { value: v, rest: s.slice(m[1].length).trim() };
  }
  return null;
}

/** Snap to nearest 1/4 oz and express as a bartender-readable fraction. */
const FRAC_LABEL = ["", "1/4", "1/2", "3/4"];

function formatOzValue(oz) {
  const quarters = Math.round(oz * 4);
  if (quarters === 0) return null; // too small to express; caller keeps original
  const whole = Math.floor(quarters / 4);
  const frac = FRAC_LABEL[quarters % 4];
  if (whole === 0) return `${frac} oz`;
  if (!frac) return `${whole} oz`;
  return `${whole} ${frac} oz`;
}

/** Find first volume unit in string: { key, start, length } */
function findVolumeUnit(s) {
  let best = null;
  const lower = s.toLowerCase();

  const floz = /\bfl\.?\s*oz\b/i.exec(s);
  if (floz) {
    best = { key: "oz", start: floz.index, length: floz[0].length, alreadyOz: true };
  }

  for (const key of UNIT_KEYS) {
    const re = new RegExp(`\\b${escapeRe(key)}s?\\b`, "i");
    const m = re.exec(s);
    if (!m) continue;
    const { index } = m;
    if (best == null || index < best.start) {
      best = { key, start: index, length: m[0].length, alreadyOz: key === "oz" || key === "ounce" || key === "ounces" };
    } else if (index === best.start && m[0].length > best.length) {
      best = { key, start: index, length: m[0].length, alreadyOz: key === "oz" || key === "ounce" || key === "ounces" };
    }
  }

  return best;
}

function convertSingle(s) {
  const trimmed = s
    .trim()
    .replace(/(\d+)(cl|ml|oz|l)\b/gi, "$1 $2");
  if (!trimmed || !/\d/.test(trimmed)) return trimmed;

  const unit = findVolumeUnit(trimmed);
  if (!unit) return trimmed;

  const numPart = trimmed.slice(0, unit.start).trim();
  const after = trimmed.slice(unit.start + unit.length).trim();
  const parsed = parseLeadingNumber(numPart);
  if (!parsed) return trimmed;

  const mlPer = UNIT_TO_ML[unit.key];
  if (mlPer == null) return trimmed;

  if (unit.alreadyOz || unit.key === "oz" || unit.key === "ounce" || unit.key === "ounces") {
    const formatted = formatOzValue(parsed.value);
    if (formatted == null) return trimmed;
    return after ? `${formatted} ${after}` : formatted;
  }

  const oz = (parsed.value * mlPer) / ML_PER_OZ;
  const formatted = formatOzValue(oz);
  if (formatted == null) return trimmed;
  return after ? `${formatted} ${after}` : formatted;
}

function convertFragment(fragment) {
  const s = fragment.trim();
  if (!s) return s;

  const rangeMatch = /^(.+?)\s*-\s*(.+)$/.exec(s);
  if (rangeMatch && /\d/.test(rangeMatch[1]) && /\d/.test(rangeMatch[2])) {
    const left = convertSingle(rangeMatch[1].trim());
    const right = convertSingle(rangeMatch[2].trim());
    if (left !== rangeMatch[1].trim() || right !== rangeMatch[2].trim()) {
      return `${left} – ${right}`;
    }
  }

  return convertSingle(s);
}

/**
 * Display cocktail measures in US fluid ounces when a known volume unit appears.
 * Splits on " / " so compound measures convert piece by piece.
 */
export function formatMeasureToOz(measure) {
  if (measure == null) return "";
  const raw = String(measure).trim();
  if (!raw) return "";

  if (raw.includes(" / ")) {
    return raw
      .split(" / ")
      .map((p) => convertFragment(p.trim()))
      .join(" / ");
  }

  return convertFragment(raw);
}

/**
 * Replace volume phrases inside free-form text (e.g. CocktailDB instructions: "add 6 cl …").
 * Scans left-to-right; each numeric span that forms a measure with a known unit is converted to oz.
 */
export function formatInstructionTextToOz(text) {
  if (text == null || text === "") return "";
  const s = String(text);
  let out = "";
  let i = 0;

  while (i < s.length) {
    const rel = s.slice(i);
    const d = rel.search(/\d/);
    if (d < 0) {
      out += rel;
      break;
    }
    out += rel.slice(0, d);
    i += d;

    const fromDigit = s.slice(i);
    const unit = findVolumeUnit(fromDigit);
    if (!unit) {
      out += s[i];
      i++;
      continue;
    }

    const end = unit.start + unit.length;
    const chunk = fromDigit.slice(0, end).trimEnd();
    const converted = formatMeasureToOz(chunk);
    if (converted && converted !== chunk) {
      out += converted;
      i += end;
    } else {
      out += s[i];
      i++;
    }
  }

  return out;
}
