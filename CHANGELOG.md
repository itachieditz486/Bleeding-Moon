# Changelog
## 0.2.0 - Android controls, smoother feel, main-menu flow, APK pipeline
* Feel: action inputs (attack/dash/special) buffered 0.14 s; faster direction reversal (x1.7 acceleration when reversing); jump can cancel sword *recovery* (never the hit window); input latch so a tap shorter than one 60 Hz step is never dropped (keyboard and touch); allocation-free entity list upkeep and trail handling. Health, damage, boss HP, i-frames, dash cooldown and telegraph timings are unchanged (a test asserts this).
* Touch: new floating move-stick (trailing origin + hysteresis), JUMP / ATK / DASH / SHADOW / PAUSE buttons in a two-column layout that avoids the HUD and boss bar; one finger owns one control until lifted; pointercancel / lost capture / window-level release / blur all release; click/dblclick/contextmenu/touch scrolling suppressed; safe-area insets; opacity and size settings; overlay hidden in menus and pause.
* Menus: pause menu has RESUME, RESTART CHECKPOINT, SETTINGS, CONTROLS, MAIN MENU; progress saved on pause and on leaving; boss music/wind stopped and boss audio freed on return; Settings split into Audio and Touch-and-display pages, each with BACK.
* Build: root `package.json`, `capacitor.config.json`, GitHub Actions workflow, Android patch script (landscape, immersive, cutout, icon), `ANDROID_BUILD_GUIDE.md`. Test harness now starts its own server.
* Fixed: stage loads now clear leftover hit-stop/shake timers (could swallow the first inputs after loading); boss bar narrowed so touch buttons never overlap it.
## 0.1.0 - first playable build
* Playable game: hooded protagonist (idle, walk, run, jump/fall, land, turn, 3-hit attack, special, dash, hurt + i-frames, death/respawn), ghoul + wisp enemies, 3 bosses, 5 stages.
* Combat: explicit hit windows (one hit per target per swing), knockback, hit-stop, screen shake, energy/special, dash i-frames.
* Bosses: telegraph -> act -> recover beat system with enforced 0.45 s minimum warning, poise/stagger, phase thresholds, transitions, defeat sequences, per-boss audio cues.
* Menus: title, intro text sequence, New Game overwrite confirmation, Continue with save validation, Settings, Controls, Pause, Victory + Play Again.
* Checkpoints + save/continue, keyboard + multitouch Android controls, PWA offline cache, single-file build.
* Audio: 20 OGG files integrated via AudioManager + synthesised wind/thunder/footsteps/growls/hurt/whoosh.
* Known: no human playtest yet; difficulty/balance and audio mix are untuned; no APK.
## 0.0.1 - audio system only (earlier turn)
