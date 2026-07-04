// soulcaster — procedural character-sheet generator for Sei.
//
// Two stages, deliberately split:
//   Stage 1  rollFields()  — pure, non-LLM randomizer. All variety lives here.
//   Stage 2  castSoul()    — an injected LLM consolidates the rolled fields into
//                            a rich, internally consistent, image-reproducible
//                            character sheet.
//
// The package never touches API keys in library use: the caller injects an
// `llm` function wired to their own backend.

import { z } from 'zod';
import {
  AGE_RANGES,
  DEFAULT_AGE_RANGE,
  BACKGROUNDS,
  HAIR_COLORS,
  HAIR_STYLES,
  EYE_COLORS,
  EYE_SPECIAL,
  HEIGHTS,
  BUILDS,
  BUSTS,
  PERSONALITY_SEEDS,
  QUIRK_SEEDS,
  PALETTE_ACCENTS,
} from './tables.js';
import { buildSystemPrompt, buildUserPrompt, buildRetrySuffix } from './prompt.js';

export {
  AGE_RANGES,
  DEFAULT_AGE_RANGE,
  BACKGROUNDS,
  HAIR_COLORS,
  HAIR_STYLES,
  EYE_COLORS,
  EYE_SPECIAL,
  HEIGHTS,
  BUILDS,
  BUSTS,
  PERSONALITY_SEEDS,
  QUIRK_SEEDS,
  PALETTE_ACCENTS,
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SoulcasterError extends Error {
  constructor(message, { cause, raw } = {}) {
    super(message);
    this.name = 'SoulcasterError';
    if (cause) this.cause = cause;
    if (raw !== undefined) this.raw = raw;
  }
}

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) — for seeded/CLI use and tests.
// ---------------------------------------------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Roll helpers
// ---------------------------------------------------------------------------

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeighted(entries, rng) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r < 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

function pickTwoDistinct(arr, rng) {
  const first = pick(arr, rng);
  let second = pick(arr, rng);
  let guard = 0;
  while (second === first && guard < 50) {
    second = pick(arr, rng);
    guard += 1;
  }
  return [first, second];
}

function rollInt(min, max, rng) {
  return min + Math.floor(rng() * (max - min + 1));
}

function rollEyeColor(rng) {
  // ~8% chance of a rare special (heterochromia) roll.
  if (rng() < 0.08) return pick(EYE_SPECIAL, rng);
  return pick(EYE_COLORS, rng);
}

function resolveAge(userProfile, rng) {
  const rangeKey = userProfile && userProfile.companion_age_range;
  const range = (rangeKey && AGE_RANGES[rangeKey]) || DEFAULT_AGE_RANGE;
  const age = rollInt(range.min, range.max, rng);
  return { age, apparent_only: Boolean(range.apparent_only) };
}

// ---------------------------------------------------------------------------
// Stage 1: rollFields (pure)
// ---------------------------------------------------------------------------

const GENDERS = ['male', 'female', 'other'];

export function rollFields({ gender, userProfile = null, rng = Math.random } = {}) {
  if (!GENDERS.includes(gender)) {
    throw new SoulcasterError(`gender must be one of ${GENDERS.join('|')}, got: ${JSON.stringify(gender)}`);
  }

  const background = pickWeighted(BACKGROUNDS, rng);
  const hair_color = pick(HAIR_COLORS, rng);
  const hair_style = pick(HAIR_STYLES, rng);
  const eye_color = rollEyeColor(rng);
  const height = pick(HEIGHTS, rng);
  const build = pick(BUILDS, rng);
  const { age, apparent_only } = resolveAge(userProfile, rng);
  const personality_seeds = pickTwoDistinct(PERSONALITY_SEEDS, rng);
  const quirk_seed = pick(QUIRK_SEEDS, rng);
  const palette_accent = pick(PALETTE_ACCENTS, rng);

  const rolled = {
    gender,
    background,
    hair_color,
    hair_style,
    eye_color,
    height,
    build,
    age,
    apparent_only,
    personality_seeds,
    quirk_seed,
    palette_accent,
  };

  // bust is rolled only for female characters; omitted otherwise.
  if (gender === 'female') {
    rolled.bust = pick(BUSTS, rng);
  }

  return rolled;
}

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

export const CharacterSheetSchema = z.object({
  name: z.string().min(1),
  gender: z.enum(['male', 'female', 'other']),
  age: z.number(),
  age_note: z.string().nullable(),
  background: z.enum(['human', 'elf', 'robot', 'beastkin']),
  species_detail: z.string().min(1),
  personality: z.object({
    tone: z.string().min(1),
    values: z.array(z.string().min(1)).min(3).max(5),
    quirks: z.array(z.string().min(1)).min(2).max(3),
    fears: z.array(z.string().min(1)).min(1).max(2),
  }),
  backstory: z.string().min(1),
  voice_style: z.string().min(1),
  appearance: z.object({
    overall: z.string().min(1),
    hair: z.string().nullable(),
    eyes: z.string().min(1),
    skin: z.string().min(1),
    height: z.string().min(1),
    build: z.string().min(1),
    bust: z.string().nullable(),
    outfit: z.string().min(1),
    accessories: z.array(z.string().min(1)),
    distinguishing_features: z.array(z.string().min(1)).min(1).max(3),
  }),
  image_prompt: z.string().min(1),
});

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

// Strip markdown code fences and isolate the outermost JSON object, so a chatty
// model that wraps its answer still parses.
export function stripFences(text) {
  if (typeof text !== 'string') return '';
  let s = text.trim();
  // Remove a leading ```json / ``` fence and trailing ```.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // Isolate from first { to last }.
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s;
}

function parseAndValidate(rawText) {
  const cleaned = stripFences(rawText);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return { ok: false, error: `not valid JSON: ${err.message}` };
  }
  const result = CharacterSheetSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `schema validation failed: ${result.error.message}` };
  }
  return { ok: true, sheet: result.data };
}

// ---------------------------------------------------------------------------
// Stage 2: castSoul
// ---------------------------------------------------------------------------

// llm signature: async ({ system, user, maxTokens }) => string
export async function castSoul({ gender, userProfile = null, llm, rng = Math.random } = {}) {
  if (typeof llm !== 'function') {
    throw new SoulcasterError('castSoul requires an `llm` function: async ({ system, user, maxTokens }) => string');
  }

  const rolled = rollFields({ gender, userProfile, rng });
  const system = buildSystemPrompt();
  const baseUser = buildUserPrompt({ gender, userProfile, rolled });

  let lastError = null;
  let lastRaw = null;

  // Attempt 1, then a single retry with the validation error appended.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const user = attempt === 0 ? baseUser : baseUser + buildRetrySuffix(lastError);
    let raw;
    try {
      raw = await llm({ system, user, maxTokens: 4096 });
    } catch (err) {
      throw new SoulcasterError(`llm call failed: ${err.message}`, { cause: err });
    }
    lastRaw = raw;
    const res = parseAndValidate(raw);
    if (res.ok) {
      return { sheet: res.sheet, rolled };
    }
    lastError = res.error;
  }

  throw new SoulcasterError(`character sheet invalid after retry: ${lastError}`, { raw: lastRaw });
}
