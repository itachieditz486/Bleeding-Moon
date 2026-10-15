# Test report - Bleeding Moon 0.2.0 (Android controls / feel / menu flow / APK pipeline)

Environment: headless desktop Chromium via Playwright on Linux (software rendering), touch tests use Chromium's touch emulation and synthetic Pointer Events. Last run: 2026-10-15.
**Nothing was run on a real Android device. The APK was not built. The GitHub Actions workflow was not run.**

## What actually ran (all green on the final code)
| Command | Result |
|---|---|
| `node tests/run_game_tests.mjs` (existing 0.1.1 suite, updated for the new menus) | **42/42** |
| `node tests/run_android_tests.mjs` (new) | **30/30** |
| `node tests/run_audio_tests.mjs` + `python3 -I tools/verify_audio.py` | **30/30**, PASS |
| `node tests/bossbot.mjs` | all 3 bosses reach every phase and a defeat state; no JS errors (bot heals itself - see caveat) |
| `node tests/single_file.mjs` | `dist/Bleeding-Moon-single.html` boots from `file://`, 17 audio buffers decode, no console errors |
| `node tests/offline.mjs` | service worker caches 51 files; with the browser offline, reload -> play starts, audio decodes |
| prepared `www/` folder (what Capacitor packages) | served separately: boots, 20 audio buffers decode (incl. boss group), **0 failed/404 requests** |
| `.github/workflows/android-apk.yml` | YAML parses (PyYAML) - that is all that was verified |
| `tools/patch_android.py` on a mock Capacitor tree | manifest gets `sensorLandscape` once (idempotent), icons written, `MainActivity.java` written and **compiles against stub Android classes** (not against the real SDK) |

## Coverage of your checklist
1. *Existing game tests* - run, 42/42.
2. *Main menu opens, every option responds* - every title/pause/settings/controls/confirm item activated by test; BACK exists in Settings, Touch-and-display, Controls and returns to the correct screen.
3. *Continue / New Game / Settings / Back / Pause / Resume / Main Menu* - tested, incl. New Game overwrite confirmation (No keeps, Yes erases), Continue restoring checkpoint + defeated bosses after MAIN MENU, RESTART CHECKPOINT (full HP, hazards cleared, unpaused), Esc pause freezes the world for real-time 0.8 s.
4. *Every mobile button, move + attack together* - ATK, JUMP, DASH, SHADOW, PAUSE each tested; stick + all four action buttons held at once all registered, then released independently.
5. *Releasing a touch always releases the control* - pointerup, pointercancel, lost pointer capture, release outside the element (window-level), window blur, and a second finger trying to steal the stick; slide-off-a-button does not press the neighbour. Overlay hidden in pause/menus (which releases everything).
6. *Sword, jump, dash, shadow* - hit-once-per-swing, combo chain, buffered attack/dash, jump cancels recovery but not the hit window, 100 consecutive jump/landings with reliable ground detection, dash i-frames, shadow cost + piercing wave.
7. *JS errors / broken paths* - no page errors or console warnings in the runs (the only tolerated message is the expected 404 for a missing `sw.js`/favicon in non-service-worker contexts and the boss-audio "not loaded" warning when a test fast-forwards faster than the files load); 0 failed requests from `www/`.
8. *Audio and save still work* - audio suite 30/30, boss music start/stop and ambience restore tested via MAIN MENU, volume/mute persistence, save validation (6 corrupt/tampered cases rejected), settings (opacity/size) persist across reload.
9. *Android build workflow* - **not run** (see below).
10. *Not performed:* see the next section.

## Smoothness: what was measured
* Per-frame CPU cost (update+draw): ~0.3-0.4 ms for a normal frame in the profiler (`tests/profile.mjs`); boss fight with extra particle bursts: average 1.4-1.8 ms, p99 5-21 ms (occasional spikes up to ~40 ms, GC/JIT, not chased further). Desktop software-rendered Chromium - **this does not predict phone performance**; I did not and cannot promise 60 FPS on any particular Android device. Auto quality reduction (particles) exists and is tested at the setting level, not under real load.
* Camera: max per-frame movement <= 6 px while running, reversing and dashing (test).
* Movement: reversing from a run to -50 px/s takes <= 14 frames; stopping from a run takes <= 12 frames (tests). Whether it *feels* right was not judged by a human.
* Difficulty unchanged: a test asserts i-frames 1.3 s, dash cooldown 0.55 s, dash i-frames 0.24 s, special cost 30, stun 0.28 s, player HP 5, boss HP 60/70/110 and the 0.45 s telegraph floor are identical to 0.1.1. The input buffering and jump-cancel make the *player* slightly more forgiving about timing, not the enemies tougher or easier.

## NOT tested - needs you / a device
* **Physical Android devices** (any): touch feel, thumb reach/size on real screens, notches/cutouts, safe areas, multi-touch hardware limits, audio after first tap in the WebView, orientation lock, battery/thermals, real frame rate.
* **The APK and the GitHub Actions run.** The sandbox had no route to npm, GitHub or the Android SDK servers. Possible first-run failures I cannot rule out: a Capacitor/Gradle/SDK version mismatch, a Gradle download problem, an `android-actions/setup-android` change. The workflow fails visibly if anything breaks and never reports a build it did not make. No `package-lock.json` exists (cannot be generated offline) - the workflow uses `npm install` and uploads the generated lock file for you to commit.
* The generated Android project is patched by `tools/patch_android.py` (landscape, immersive fullscreen, cutout, icon). If Capacitor's template differs from what the script expects it prints a WARNING and the APK still builds, just without that tweak.
* Human playtest of boss fairness/pacing (the bot test heals itself and takes ~160 s on the Wraith), audio mix by ear, Firefox/Safari/iOS, gamepads, screen sizes other than 960x540, 844x390, 1280x720.
* Frame-rate-independent rendering on 90/120 Hz screens: logic runs at a fixed 60 Hz and the picture is drawn once per display refresh without interpolation, so on high-refresh phones motion is 60 Hz-smooth, not 120 Hz.
* Memory use on a low-RAM phone (about 24 MB of decoded audio at start, plus the boss group while fighting; freed ~1.5-6 s after leaving).

## Bugs found and fixed in this round
* A hit-stop/shake timer left over from the previous stage could swallow the first inputs after a stage load (found by a flaky test).
* Very short taps (press+release inside one 60 Hz step) were lost for keyboard and touch -> input latch.
* Touch cluster overlapped the boss health bar on a 844x390 phone -> narrower two-column layout and a narrower bar.
* Pause hint text overlapped the boss bar -> moved.
* Touch overlay stayed visible over the pause menu -> hidden while paused.
