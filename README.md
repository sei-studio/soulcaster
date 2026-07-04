# soulcaster

Procedural character-sheet generator for [Sei](https://sei.gg), a Minecraft AI-companion app.

soulcaster turns a gender and an optional user profile into a fully specified character sheet: name, background, species detail, personality, an elaborate backstory, a head-to-toe appearance, and a self-contained image prompt. The output is specific enough that the character has a clear story and that an image model reproduces the same character consistently across runs.

## Two-stage design

Generation is split into two stages on purpose.

**Stage 1: a non-LLM randomizer (`rollFields`).** A pure function that rolls concrete traits from weighted option tables: background, hair color and style, eye color, height, build, bust (female only), age, two contrasting personality seeds, a quirk, an outfit accent color, and a combat stat block. All randomness lives here.

The reason to keep randomness out of the model is bias. When an LLM is asked to invent a character from scratch it collapses toward clichés, the same few "cool" hair colors and the same handful of tropes, run after run. Rolling the traits first and handing them to the model as fixed constraints forces real variety: 22 hair colors, 24 personality words picked two at a time, four backgrounds by weight, and so on.

**Stage 2: LLM consolidation (`castSoul`).** The rolled fields plus any user preferences are handed to an injected `llm` function, which weaves them into a coherent sheet. The model may consolidate or drop fields that do not apply (a robot with no hair drops the hair field so the image model is not confused), and must add clothing, accessories, species detail, distinguishing features, and a 150 to 300 word backstory that explains how the appearance and personality cohere. Output is strict JSON, validated with zod; on a parse or schema failure it retries once with the validation error appended, then throws a typed error.

The package never touches API keys in library use. The caller injects an `llm` function wired to its own backend.

## Install

Requires Node.js 18+.

```sh
npm install
```

## Library usage

```js
import { castSoul, rollFields, CharacterSheetSchema } from 'soulcaster';

// Stage 1 only: just the rolled traits (pure, synchronous).
const rolled = rollFields({ gender: 'female', userProfile: { companion_age_range: 'adult' } });

// Full sheet: inject your own LLM. Signature:
//   async ({ system, user, maxTokens }) => string   (the model's raw text)
const llm = async ({ system, user, maxTokens }) => {
  // call your backend here, return the raw string response
};

const { sheet, rolled: rolledUsed } = await castSoul({
  gender: 'female',
  userProfile: { companion_age_range: 'adult', art_style: 'soft anime' },
  llm,
});

// `sheet` is validated against CharacterSheetSchema.
```

`castSoul` accepts an optional `rng` (default `Math.random`) so rolls can be made deterministic.

### User profile

The optional `userProfile` object is treated loosely. Known keys:

- `companion_age_range`: `young-adult` (18-25), `adult` (26-35), `mature` (36-50), `elder` (51-75), or `timeless` (rolls an apparent age of 18-35 and flags the character as an ancient being, so the model writes the real age into `age_note`).
- `art_style`: passed to the model as context only. It is never written into `image_prompt` — the caller appends style words themselves.

Any other keys are passed through to the model as extra context.

### Combat

`rollFields` also rolls a `combat` block: four scores in `[0,1]`, quantized to 0.05 steps, plus an `archetype` label. These numbers are pure Stage-1 output — the LLM in Stage 2 is asked to echo them verbatim (and to write a backstory/personality that fits them), but `castSoul` re-stamps `sheet.combat = rolled.combat` after validation regardless, so LLM drift can never change the numbers that ship.

The four stats and what they mean to the Minecraft bot adapter that consumes them (soulcaster only produces the numbers):

- **`melee`** — sword/axe skill. Hit chance = `50% + melee*50%` (melee is forgiving to land: 0 -> 50% hit chance, 1 -> 100%).
- **`ranged`** — bow/crossbow skill. Accuracy = `ranged*100%`. Also proxies draw strength: how fully the character draws the bow before releasing (draw fraction ~= `0.5 + ranged*0.5`), so a weak archer releases early with less damage and arrow velocity.
- **`defense`** — reaction speed, dodge chance, and the discipline to proactively open distance to heal or draw a bow. Dodge chance ~= `defense`; reaction delay lerps from ~600ms (low defense) to ~100ms (high defense); disengage-to-heal propensity scales with it too.
- **`intelligence`** — battle IQ / combo play. Melee crit attempts (jumping and striking mid-fall) chance ~= `intelligence*0.5` per engagement. Also governs weapon-switch discipline (swapping melee/bow at the correct range), the quality of retreat-to-heal timing, and strafe unpredictability.

Independent uniform rolls per stat would make every character mid-pack, so the roller picks a weighted **archetype** first (`brawler`, `sharpshooter`, `duelist`, `tactician`, `skirmisher`, `juggernaut`, `balanced`, `noncombatant` — see `COMBAT_ARCHETYPES` in `src/tables.js`), each defining a `[min,max]` band per stat, then applies a small per-species bump (`COMBAT_SPECIES_MODIFIERS`: elf leans ranged/defense, beastkin leans melee/defense, robot leans ranged/intelligence, human gets a slight intelligence edge) before quantizing. Run `node scripts/combatStudy.js` to see the resulting distribution (per-stat histograms, archetype frequency, per-species means, sample characters).

## CLI

For testing and manual generation.

```sh
# Skip the LLM: print the rolled fields plus a stub sheet.
node src/cli.js --gender female --mock

# Deterministic rolls with a seed.
node src/cli.js --gender female --seed 42 --mock

# With a profile file.
node src/cli.js --gender other --profile profile.json --mock

# Real generation (needs ANTHROPIC_API_KEY; model claude-haiku-4-5).
export ANTHROPIC_API_KEY=sk-ant-...
node src/cli.js --gender female --seed 42
```

The Anthropic fetch lives only in the CLI. It is a convenience for testing and is never part of the library path.

## Output schema

`CharacterSheetSchema` (zod, exported) validates:

```
{
  name,                       // first name, optionally with an epithet
  gender,                     // male | female | other
  age, age_note,              // number; note like "appears 24, is 312" or null
  background,                 // human | elf | robot | beastkin
  species_detail,             // e.g. "wood elf with tapered ears"
  personality: {
    tone,                     // one line
    values,                   // 3 to 5 items
    quirks,                   // 2 to 3 items
    fears                     // 1 to 2 items
  },
  backstory,                  // 150 to 300 words
  voice_style,                // how they talk, 1 to 2 sentences
  combat: {                   // rolled in Stage 1, re-stamped after validation
    archetype,                // e.g. "brawler", "sharpshooter", "tactician"
    melee, ranged,            // 0 to 1, quantized to 0.05 steps
    defense, intelligence     // 0 to 1, quantized to 0.05 steps
  },
  appearance: {
    overall,
    hair,                     // null when the character has none (robots)
    eyes, skin, height, build,
    bust,                     // null unless applicable
    outfit,                   // specific garments and colors
    accessories,              // list
    distinguishing_features   // 1 to 3 items
  },
  image_prompt                // one self-contained paragraph, no art-style words
}
```

## Package surface

```
src/
  index.js   castSoul, rollFields, CharacterSheetSchema, AGE_RANGES, option tables, mulberry32
  tables.js  all option tables
  prompt.js  system and user prompt builders
  cli.js     CLI (--gender, --profile, --seed, --mock)
scripts/
  combatStudy.js  distribution study for the combat roller (no deps)
tests/       node:test suite (npm test, no API key needed)
```

## Tests

```sh
npm test
```

The suite covers roll determinism under a seeded rng, full table coverage over many rolls, bust rolled for female only, age-range mapping, the `castSoul` happy path with a mock llm, the invalid-then-valid retry path, throwing after two failures, and code-fence stripping.

## License

MIT
