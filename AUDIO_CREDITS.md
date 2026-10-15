# Audio credits and licenses

All audio lives in `assets/audio/` and is bundled locally (no remote files).
Original license files are preserved verbatim in `assets/audio/licenses/`.
Total imported audio: **1.73 MB, 20 Ogg Vorbis files** (limit: 30 MB).

## 1. OGG Horror SFX Volume 1 - Free Pack, by obsydianx  -  CC BY 4.0
- Source: https://obsydianx.itch.io/
- License: Creative Commons Attribution 4.0 - https://creativecommons.org/licenses/by/4.0/
- **Attribution is required.** Keep this credit in the game (credits screen or store page):

  > Horror ambience and stingers: "OGG Horror SFX Volume 1 - Free Pack" by obsydianx
  > (https://obsydianx.itch.io/), licensed CC BY 4.0
  > (https://creativecommons.org/licenses/by/4.0/). Modified: trimmed, faded, looped,
  > level-matched and re-encoded.

- **Changes made** (required by CC BY): trimmed to the useful part, short fade-outs,
  level matching, re-encoded to Ogg Vorbis. The two drones were additionally re-rendered
  as seamless loops (equal-power crossfade of the loop start with the material that
  follows the loop end).

| Game file | Original file |
|---|---|
| ambience/amb_exploration.ogg | drones/horror_01_drone_01.ogg (6.0-46.0 s, looped) |
| ambience/amb_dread.ogg | drones/horror_01_drone_glitch_01.ogg (3.0-43.0 s, looped) |
| stingers/sfx_impact_major.ogg | stingers/horror_01_stinger_impact_01.ogg |
| stingers/sfx_boss_phase.ogg | stingers/horror_01_stinger_drum_1_01.ogg |
| stingers/sfx_boss_transform.ogg | stingers/horror_01_stinger_synth_1_01.ogg |
| stingers/sfx_boss_defeat.ogg | stingers/horror_01_stinger_violin_01.ogg |
| stingers/sfx_player_death.ogg | stingers/horror_01_stinger_piano_01.ogg |
| sfx/sfx_telegraph_knight.ogg | stingers/horror_01_stinger_drum_1_glitch_01.ogg |
| sfx/sfx_telegraph_wraith.ogg | stingers/horror_01_stinger_violin_glitch_01.ogg |
| sfx/sfx_telegraph_sovereign.ogg | stingers/horror_01_stinger_synth_1_glitch_01.ogg |

## 2. Genesis RPG SFX - Free Sampler (published by The Venice Menace Baking Co.)  -  CC0
- License: CC0 / public domain. No credit required; given here as a courtesy.
- Changes: level matching and re-encoding to Ogg Vorbis only.

| Game file | Original file |
|---|---|
| sfx/sfx_hit_sword.ogg | ogg/sword-hit-01.ogg |
| sfx/sfx_shadow_cast.ogg | ogg/fire-spell-cast-01.ogg (played at 0.7x speed in-game) |
| sfx/sfx_explosion.ogg | ogg/explosion-01.ogg |
| sfx/sfx_heal.ogg | ogg/heal-spell-01.ogg |
| sfx/sfx_gate_open.ogg | ogg/chest-open-01.ogg |
| ui/ui_confirm.ogg | ogg/menu-confirm-01.ogg (also used as `ui_move`, sped up and quieter) |
| ui/ui_checkpoint.ogg | ogg/quest-accept-01.ogg |
| ui/sfx_victory.ogg | ogg/quest-complete-01.ogg |

## 3. LICENSE NOT VERIFIED - supplied by the project owner
| Game file | Original file |
|---|---|
| music/music_boss.ogg | boss_battle_16bit2.mp3 (5.2 s-52.6 s, 32 bars at 162 BPM, looped) |
| sfx/sfx_boss_rumble.ogg | weird_pack_20.wav (first 8 s, boosted about +20 dB) |

**No author, license or source came with these two files** (only an "FL Studio 2024"
encoder tag). They are integrated because they were supplied for this purpose and are the
only boss music / boss-intro sound available, but their legal status is unknown.
See `assets/audio/licenses/UNVERIFIED-boss_battle_16bit2_and_weird_pack_20.txt`.
Confirm you may redistribute them before publishing.

## Not used, and why
| Source file | Reason |
|---|---|
| Genesis `mp3/` folder (10 files) | Same sounds as `ogg/`; only one format kept |
| horror_01_stinger_piano_ring_mod_01 | Same performance as stinger_piano_01 (measured: identical envelope) |
| horror_01_stinger_impact_glitch_01 | Near-copy of stinger_impact_01 (envelope similarity 0.86) |
| Genesis coin-pickup-01, level-up-fanfare-01 | No coins/levels in the design; fanfare overlaps quest-complete |

## Not in any pack (not faked)
Wind, distant thunder, footsteps, monster growls/voices, player hurt voice, and a
dedicated menu-navigation tick. `audio-manifest.json` lists these under `notSupplied`.
`ui_move` reuses `ui_confirm` at 1.6x speed and low volume as a stand-in.

## 4. Synthesised sounds (original, no third-party license)
Wind, distant thunder, footsteps, monster growls, player-hurt, jump/land/dash and sword whoosh are generated at runtime by `src/audio/SynthSfx.js`
(Web Audio oscillators + filtered noise, written for this project). They contain no recorded or sampled material.
