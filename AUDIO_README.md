# Audio integration

```
assets/audio/            20 .ogg files + audio-manifest.json + licenses/
src/audio/AudioManager.js   Web Audio mixer (ES module, no dependencies)
tools/build_audio.py        rebuilds every .ogg from the original packs
tools/verify_audio.py       decodes the .ogg files; checks peaks, loop seams, near-duplicates, size
tests/run_audio_tests.mjs   headless-Chromium tests of AudioManager (30 checks)
```

## Using it
```js
import AudioManager from './audio/AudioManager.js';
const audio = new AudioManager({ manifestUrl: 'assets/audio/audio-manifest.json' });
await audio.init(); audio.unlockOnGesture();      // first tap/key starts the audio context
await audio.loadGroup('core'); await audio.loadGroup('explore');
audio.enterArea('castle_exploration');
audio.play('sfx_hit_sword');  audio.play('ui_move');
await audio.loadGroup('boss'); audio.enterBoss('hollow_knight');   // load when the player nears the arena
audio.cue('hollow_knight', 'telegraph');  audio.cue('hollow_knight', 'phase');  audio.cue('hollow_knight', 'defeat');
audio.exitBoss(); audio.unloadGroup('boss');
audio.setMasterVolume(0.7); audio.toggleMute();    // saved to localStorage
```
Boss ids: `hollow_knight`, `abyssal_wraith`, `fallen_sovereign`. Areas: see `areas` in the manifest.

## Android / offline notes
* Files are Ogg Vorbis (gapless loops). Android Chrome and Android WebView play it; iOS Safari historically did not, so add MP3 copies if you ever target iOS.
* Everything is loaded from relative paths with XHR, so it works bundled in a Capacitor/Cordova app. If you ship as a PWA, add every file in `audio-manifest.json` to the service-worker precache.
* Decoded audio is about 56 MB if everything is loaded at once. Load `boss` only near a boss and call `unloadGroup('boss')` after (about 24 MB without it).
* `amb_exploration` is almost pure sub-bass (centroid about 65 Hz). Phone speakers reproduce little below about 150 Hz, so expect it to be nearly inaudible without headphones; `amb_dread` carries mids and is audible on phone speakers.
* Rebuild: `python3 -I tools/build_audio.py --horror <dir> --genesis <dir> --boss <mp3> --weird <wav>`
