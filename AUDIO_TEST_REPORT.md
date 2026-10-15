# Audio test report (2026-10-13)

## What actually ran
`NODE_PATH=$(npm root -g) node tests/run_audio_tests.mjs` - **30/30 passed** in headless Chromium (desktop, Linux).
`python3 -I tools/verify_audio.py` - **PASS**.

| Area | Verified |
|---|---|
| Size | 20 files, 1.73 MB total (limit 30 MB) |
| Files | every manifest file exists, no orphans, each sound in exactly one group, aliases/areas/boss cues resolve |
| Decoding | all 20 files decode in Chromium; durations match ffprobe within 50 ms |
| Levels | no clipping in any encoded file |
| Loops | the 3 loops, played back-to-back, have no click at the seam, no level jump outside the file's normal range, no hole in the crossfade |
| Duplicates | closest pair of shipped files scores 0.72 on a metric where a known true duplicate scores 0.83 (threshold 0.80) |
| Manager | unlock after gesture; cooldowns; voice cap; unknown keys are silent no-ops; boss enter/exit; all 12 boss cues; mute zeroes the output bus (measured with an analyser); volume + mute persist across reload; unloadGroup frees memory |
| Offline | no request left the local origin; manager has no http(s) URLs; groups load over file:// (simulated Android WebView, needs `--allow-file-access-from-files` on desktop Chromium) |

## NOT tested - needs a human or a device
* **Nobody has listened to any of this.** Sound selection and mixing were done from file names, measurements (loudness, spectrum, envelope, tempo) and spectrograms. Whether a sound *sounds* right for its role, whether the boss loop is musically seamless, and the volumes in the manifest all need listening and tuning.
* Real Android hardware, real Android WebView, an APK build, audio on a phone speaker, background/resume behaviour on a phone.
* Safari/iOS, Firefox.
* Loading time and memory pressure on a mid-range phone (about 56 MB decoded when fully loaded).
* One console 404 appeared during the run. My network listener did not capture it, so I believe, but did not confirm, that it is the browser's favicon request.
* Integration with the game itself: the game does not exist in this workspace yet, so the manager is tested standalone, not wired to real gameplay events.

## Known gaps
No wind, thunder, footsteps, monster growls, player-hurt voice or menu-move tick exists in the supplied packs. Phase/defeat cues are shared between bosses and differentiated only by playback rate and layering. The boss track and the rumble file have no verified license.
