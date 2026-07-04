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
