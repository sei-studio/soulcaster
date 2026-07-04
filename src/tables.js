// Option tables for the Stage 1 randomizer.
//
// All randomness lives here, never in the LLM. LLM sampling is biased toward
// clichés (always the same handful of "cool" hair colors, the same tropes), so
// we roll concrete fields first and hand them to the model as fixed constraints.
//
// Every exported table is a plain array (uniform roll) or an array of
// { value, weight } entries (weighted roll). See rollFields in index.js.

// Companion age ranges. `timeless` rolls an APPARENT age of 18-35 but flags the
// character as an ancient being, so the LLM writes a real age into age_note.
export const AGE_RANGES = {
  'young-adult': { min: 18, max: 25 },
  adult: { min: 26, max: 35 },
  mature: { min: 36, max: 50 },
  elder: { min: 51, max: 75 },
  timeless: { min: 18, max: 35, apparent_only: true },
};

// Default when no companion_age_range is supplied.
export const DEFAULT_AGE_RANGE = { min: 18, max: 60 };

// Weighted: human is the common case, robot the rarest.
export const BACKGROUNDS = [
  { value: 'human', weight: 55 },
  { value: 'elf', weight: 20 },
  { value: 'beastkin', weight: 20 },
  { value: 'robot', weight: 15 },
];

// 22 options: natural spectrum first, then fantasy.
export const HAIR_COLORS = [
  // natural
  'black',
  'dark brown',
  'chestnut brown',
  'auburn',
  'ginger',
  'strawberry-blonde',
  'golden-blonde',
  'platinum blonde',
  'silver',
  'white',
  'ash-gray',
  // fantasy
  'sky blue',
  'teal',
  'mint-green',
  'lavender',
  'pink',
  'rose-red',
  'crimson',
  'violet',
  'black-to-red ombre',
  'blue-to-purple ombre',
  'pink-and-white two-tone',
];

// 13 options.
export const HAIR_STYLES = [
  'pixie cut',
  'short bob',
  'long straight',
  'long wavy',
  'twin-tails',
  'high ponytail',
  'side braid',
  'undercut',
  'messy short',
  'buzzed',
  'hime-cut',
  'curly shoulder-length',
  'top-knot',
];

// 14 options; heterochromia is a rare final roll (see rollEyeColor).
export const EYE_COLORS = [
  'dark brown',
  'hazel',
  'amber',
  'emerald green',
  'forest green',
  'sky blue',
  'ice blue',
  'steel gray',
  'violet',
  'crimson',
  'gold',
  'jet black',
  'pale pink',
  'turquoise',
];

// Rare special eye rolls, appended with low weight.
export const EYE_SPECIAL = ['heterochromia (one blue, one gold)', 'heterochromia (one green, one violet)'];

export const HEIGHTS = ['petite', 'short', 'average', 'tall', 'towering'];

export const BUILDS = ['slender', 'athletic', 'soft', 'curvy', 'stocky', 'lithe', 'broad'];

// Rolled only when gender === 'female'.
export const BUSTS = ['flat', 'small', 'medium', 'large'];

// 24 contrasting temperament words. Two distinct picks force personality
// diversity across generated characters.
export const PERSONALITY_SEEDS = [
  'stoic',
  'playful',
  'blunt',
  'gentle',
  'scheming',
  'earnest',
  'dry-witted',
  'brooding',
  'sunny',
  'meticulous',
  'reckless',
  'motherly',
  'aloof',
  'zealous',
  'mischievous',
  'melancholic',
  'fierce',
  'timid',
  'sardonic',
  'devoted',
  'restless',
  'serene',
  'proud',
  'curious',
];

// 16 quirky habits / obsessions.
export const QUIRK_SEEDS = [
  'hums old folk tunes while working',
  'collects smooth river stones',
  'never removes a pair of fingerless gloves',
  'talks to animals as if they answer',
  'obsessively tidies any space they enter',
  'refuses to walk on cracks',
  'names every tool and weapon',
  'sketches maps of places they visit',
  'hoards shiny trinkets like a magpie',
  'quotes proverbs at odd moments',
  'always knows which way is north',
  'sleeps with one eye metaphorically open, distrusts easily',
  'counts things under their breath',
  'keeps a running tally of favors owed',
  'cannot resist a dare',
  'brews a strange tea from foraged herbs',
];

// ---------------------------------------------------------------------------
// Combat archetypes
// ---------------------------------------------------------------------------
//
// Four combat stats — melee, ranged, defense, intelligence — are each rolled
// in [0,1] and quantized to 0.05 steps (see rollCombat in index.js). Gameplay
// meaning (consumed by the Minecraft bot adapter, not by this package):
//
//   melee         hit chance = 50% + melee*50% (melee is forgiving to land:
//                 0 -> 50% hit chance, 1 -> 100%).
//   ranged        bow/crossbow accuracy = ranged*100%. ALSO proxies draw
//                 strength: how fully the character draws the bow before
//                 releasing (draw fraction ~= 0.5 + ranged*0.5), so a weak
//                 archer releases early with less damage and arrow velocity.
//   defense       reaction speed + dodge chance + the discipline to
//                 proactively open distance to heal or draw a bow. Dodge
//                 chance ~= defense; reaction delay lerps from ~600ms (low
//                 defense) to ~100ms (high defense); disengage-to-heal
//                 propensity scales with it too.
//   intelligence  battle IQ / combo play. Melee crit attempts (jumping and
//                 striking mid-fall) chance ~= intelligence*0.5 per
//                 engagement. ALSO governs weapon-switch discipline
//                 (swapping melee<->bow at the correct range), the quality of
//                 retreat-to-heal timing, and strafe unpredictability.
//
// Independent uniform sampling of each stat would make every rolled character
// mid-pack (everything clusters near 0.5). Instead we roll a weighted
// archetype first — each archetype defines a [min,max] band per stat — so
// real builds emerge (a brawler is reliably melee-heavy and ranged-light, a
// tactician is reliably int-heavy, etc). Small per-species modifiers are
// applied afterward; they are kept small on purpose so the archetype, not the
// species, dominates the final shape.
//
// See scripts/combatStudy.js for the distribution this table produces.
export const COMBAT_ARCHETYPES = [
  {
    value: {
      label: 'brawler',
      melee: [0.55, 1.0],
      ranged: [0.0, 0.45],
      defense: [0.25, 0.75],
      intelligence: [0.15, 0.65],
    },
    weight: 20,
  },
  {
    value: {
      label: 'sharpshooter',
      melee: [0.05, 0.55],
      ranged: [0.55, 1.0],
      defense: [0.25, 0.75],
      intelligence: [0.35, 0.85],
    },
    weight: 15,
  },
  {
    value: {
      label: 'duelist',
      melee: [0.45, 0.9],
      ranged: [0.05, 0.55],
      defense: [0.55, 1.0],
      intelligence: [0.35, 0.85],
    },
    weight: 15,
  },
  {
    value: {
      label: 'tactician',
      melee: [0.25, 0.7],
      ranged: [0.25, 0.7],
      defense: [0.25, 0.7],
      intelligence: [0.65, 1.0],
    },
    weight: 10,
  },
  {
    value: {
      label: 'skirmisher',
      melee: [0.15, 0.6],
      ranged: [0.35, 0.8],
      defense: [0.45, 0.9],
      intelligence: [0.35, 0.8],
    },
    weight: 10,
  },
  {
    value: {
      label: 'juggernaut',
      melee: [0.6, 1.0],
      ranged: [0.0, 0.35],
      defense: [0.1, 0.45],
      intelligence: [0.05, 0.5],
    },
    weight: 10,
  },
  {
    value: {
      label: 'balanced',
      melee: [0.3, 0.7],
      ranged: [0.3, 0.7],
      defense: [0.3, 0.7],
      intelligence: [0.3, 0.7],
    },
    weight: 15,
  },
  {
    value: {
      label: 'noncombatant',
      melee: [0.0, 0.4],
      ranged: [0.0, 0.4],
      defense: [0.0, 0.4],
      intelligence: [0.0, 0.4],
    },
    weight: 7,
  },
];

// Small per-species bumps applied after the archetype roll, each sampled
// uniformly from the given [min,max] range and added (then clamped to [0,1]
// and re-quantized). Kept small relative to the archetype bands above so the
// archetype dominates the final build; the species only nudges it.
export const COMBAT_SPECIES_MODIFIERS = {
  elf: { ranged: [0.05, 0.15], defense: [0.05, 0.15] },
  beastkin: { melee: [0.05, 0.15], defense: [0.05, 0.15] },
  robot: { ranged: [0.05, 0.15], intelligence: [0.05, 0.15] },
  // Humans have no strong innate combat trait; a slight intelligence edge
  // (adaptability/training) rather than none, so the table isn't empty for
  // the most common background.
  human: { intelligence: [0.0, 0.08] },
};

// Outfit accent color words.
export const PALETTE_ACCENTS = [
  'crimson',
  'deep teal',
  'burnt orange',
  'royal purple',
  'forest green',
  'gold',
  'ivory',
  'charcoal',
  'rose',
  'cobalt blue',
  'amber',
  'silver',
];
