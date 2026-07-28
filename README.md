# soulcaster

Procedural character-sheet generator for [Sei](https://sei.gg), a Minecraft AI companion app.

Stage 1 rolls every trait from weighted tables. No LLM. Stage 2 hands that roll to an LLM you inject, which writes one consistent, schema-validated character sheet.

The package holds no API keys. You pass your own `llm` function.

## How it works

```
   gender, userProfile, dynamic, takenVoiceIds, rng
        |
        v
+----------------------------------------------+
| STAGE 1  rollFields()           pure, no net  |
|   weighted tables + seeded rng                |
|   tables.js  voices.js                        |
+----------------------------------------------+
        |
        |  rolled: species, age, heritage, life context, looks,
        |          personality seeds, quirk, palette, combat, voice
        v
+----------------------------------------------+
| STAGE 2  castSoul()                           |
|   prompt.js builds the system + user prompt   |
+----------------------------------------------+
        |
        v
      llm()      <-- you inject this
        |
        |  raw text
        v
+----------------------------------------------+     invalid
| stripFences -> JSON.parse -> zod schema       |---------------> retry once,
+----------------------------------------------+                 then throw
        |  valid
        v
+----------------------------------------------+
| re-stamp combat, heritage, voice_id           |
| from the Stage 1 roll                         |
+----------------------------------------------+
        |
        v
    { sheet, rolled }
```

Everything above `llm()` is pure and synchronous. Everything below it is validation, not invention.

## Why two stages

Ask an LLM for a whole character and it repeats itself. The same hair colors, the same tropes. So the variety is rolled from tables instead. The model only consolidates what it is given.

## Stage 1: the roll

| field | how it rolls |
|---|---|
| background | human 55, elf 20, beastkin 20, robot 15 |
| age | from `userProfile.companion_age_range`. `timeless` rolls an apparent age and flags it |
| looks | 22 hair colors, 13 styles, 14 eye colors plus a rare heterochromia, height, build, bust (female only) |
| personality | 2 distinct seeds from 24, blended. 1 quirk seed from 16. 1 palette accent |
| heritage | 12 naming cultures, weighted. Drives the name only, never an ethnicity claim for non-humans |
| life_context | 10 job categories, weighted by an age x category matrix |
| combat | 1 of 8 archetypes sets a band per stat, then a species bump. 4 stats in [0,1], quantized to 0.05 |
| voice | 25 curated ElevenLabs voices. Gender is a hard filter, age bands never cross, personality tags weight the pick |
| dynamic | optional. Biases the first personality seed so the requested relationship reads through |

Pass `takenVoiceIds` to keep a user's roster off the same voice. Combat is in-game playstyle only. The prompt keeps it out of the backstory.

## Stage 2: the sheet

The model writes `name`, `setting`, `species_detail`, `occupation`, `personality`, `backstory`, `player_dynamic`, `appearance`, `image_prompt`, `voice_style`, `punctuation`, and `card_line`. It must echo the rolled fields verbatim.

Output is strict JSON, validated against `CharacterSheetSchema` (zod). A parse or schema failure retries once with the error appended, then throws `SoulcasterError`.

## Drift proofing

After validation, `castSoul` overwrites `combat`, `heritage`, and `voice_id` with the rolled values. All three are closed vocabularies. A paraphrase or a dropped digit can then never desync the sheet from the roll. `occupation` and `setting` are the model's own, so they are validated but never touched.

## Determinism

Every roll takes an `rng`, default `Math.random`. Pass the exported `mulberry32(seed)` and the whole Stage 1 output is reproducible from one integer.

## Use

```js
import { castSoul, rollFields } from 'soulcaster';

// Stage 1 only. Pure and synchronous.
const rolled = rollFields({ gender: 'female', userProfile: { companion_age_range: 'adult' } });

// Full sheet. llm signature: async ({ system, user, maxTokens }) => string
const { sheet } = await castSoul({ gender: 'female', dynamic: 'caretaker', llm });
```

## CLI

```sh
node src/cli.js --gender female --seed 42 --mock   # no LLM, prints roll + stub
node src/cli.js --gender female --dynamic caretaker  # needs ANTHROPIC_API_KEY
```

The Anthropic fetch lives only in the CLI. It is never on the library path.

## Layout

```
src/index.js    castSoul, rollFields, schema, mulberry32
src/tables.js   every option table
src/voices.js   curated voice pool
src/prompt.js   prompt builders
src/cli.js      CLI
scripts/        distribution studies, voice sync
tests/          node:test suite, no API key needed
```

Node 18+. `npm test` runs the suite.

## License

MIT
