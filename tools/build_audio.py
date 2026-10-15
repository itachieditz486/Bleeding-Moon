#!/usr/bin/env python3
"""
Rebuilds every file in assets/audio/ from the original third-party packs.

Usage:
  python3 -I tools/build_audio.py --horror DIR --genesis DIR --boss FILE --weird FILE [--out assets/audio]

  --horror   extracted "OGG Horror SFX Volume 1 - Free Pack" (contains drones/ and stingers/)
  --genesis  extracted "genesis-rpg-sfx-sampler" folder (contains ogg/)
  --boss     boss_battle_16bit2.mp3
  --weird    weird_pack_20.wav

Needs: ffmpeg (with libvorbis), numpy, scipy.

What it does to each source (all changes are listed in AUDIO_CREDITS.md):
  * trims to the useful region and applies a short fade-out
  * loops (2 drones + boss music) are re-rendered with an equal-power crossfade so
    they repeat without a gap or click; the boss loop is aligned to the 162 BPM bar grid
  * level-matches by active-region RMS, with a peak ceiling, so sounds sit together
  * encodes to Ogg Vorbis (gapless, supported by Android Chrome / WebView)
"""
import argparse, os, subprocess, sys, tempfile
import numpy as np
from scipy.io import wavfile

SR = 44100
PEAK_CEIL_DB = -1.5


def db(x):
    return 20 * np.log10(max(float(x), 1e-9))


def decode(path):
    """Any audio file -> float32 stereo array at 44.1 kHz."""
    with tempfile.TemporaryDirectory() as td:
        tmp = os.path.join(td, "d.wav")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", path,
                        "-ac", "2", "-ar", str(SR), "-c:a", "pcm_f32le", tmp], check=True)
        sr, x = wavfile.read(tmp)
    assert sr == SR
    return x.astype(np.float32)


def seg(x, start, dur):
    a = int(round(start * SR))
    return x[a:a + int(round(dur * SR))].copy()


def fade_out(x, secs):
    n = min(len(x), int(secs * SR))
    if n:
        x[-n:] *= (np.linspace(1, 0, n, dtype=np.float32) ** 1.5)[:, None]
    return x


def fade_in(x, secs):
    n = min(len(x), int(secs * SR))
    if n:
        x[:n] *= np.linspace(0, 1, n, dtype=np.float32)[:, None]
    return x


def loop_render(x, start, length, xfade):
    """Seamless loop: body = x[start:start+length]. Its first `xfade` seconds are
    blended (equal power) with the material that *continues past the loop end*, so
    when playback wraps from the last sample to the first, the audio is continuous."""
    a, L, N = int(start * SR), int(length * SR), int(xfade * SR)
    body = x[a:a + L].copy()
    cont = x[a + L:a + L + N]
    assert len(cont) == N, "not enough source material after loop end for the crossfade"
    t = np.linspace(0, np.pi / 2, N, dtype=np.float32)[:, None]
    body[:N] = body[:N] * np.sin(t) + cont * np.cos(t)
    return body


def level(x, target_rms_db, ceil_db=PEAK_CEIL_DB):
    """Gain so the RMS of the *active* part (samples above -50 dB of peak) hits the target,
    never letting the peak pass the ceiling."""
    pk = np.abs(x).max()
    act = x[np.abs(x) > pk * 10 ** (-50 / 20)]
    rms = np.sqrt((act.astype(np.float64) ** 2).mean())
    g_db = target_rms_db - db(rms)
    g_db = min(g_db, ceil_db - db(pk))
    return x * np.float32(10 ** (g_db / 20)), g_db


def encode(x, out_path, quality):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        tmp = os.path.join(td, "e.wav")
        wavfile.write(tmp, SR, np.clip(x, -1, 1).astype(np.float32))
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", tmp,
                        "-c:a", "libvorbis", "-q:a", str(quality), "-map_metadata", "-1", out_path], check=True)
    return os.path.getsize(out_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--horror", required=True)
    ap.add_argument("--genesis", required=True)
    ap.add_argument("--boss", required=True)
    ap.add_argument("--weird", required=True)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "assets", "audio"))
    a = ap.parse_args()
    out = os.path.abspath(a.out)

    H = lambda sub, n: os.path.join(a.horror, sub, n)
    G = lambda n: os.path.join(a.genesis, "ogg", n)

    # ---- loops -------------------------------------------------------------------------
    # BPM 162 measured from onset analysis -> beat 0.37037 s, bar 1.48148 s. 32 bars = 47.407 s.
    bar = 4 * 60 / 162
    jobs = []

    def loop_job(name, folder, src, start, length, xf, rms, q):
        x = decode(src)
        y = loop_render(x, start, length, xf)
        y, g = level(y, rms)
        jobs.append((name, folder, y, g, q))

    loop_job("amb_exploration", "ambience", H("drones", "horror_01_drone_01.ogg"), 6.0, 40.0, 4.0, -22, 3)
    loop_job("amb_dread", "ambience", H("drones", "horror_01_drone_glitch_01.ogg"), 3.0, 40.0, 4.0, -22, 3)
    # boss music: first beat-grid point at/after 5.2 s (swell is over), 32 bars, 2-bar crossfade
    loop_job("music_boss", "music", a.boss, 5.201, 32 * bar, 2 * bar, -17, 4)

    # ---- one-shots: (name, folder, source, start, duration, fade_out, target_rms_db, quality)
    shots = [
        # Horror pack, long cinematic stingers
        ("sfx_impact_major",      "stingers", H("stingers", "horror_01_stinger_impact_01.ogg"),   0, 3.6, 0.6, -18, 4),
        ("sfx_boss_phase",        "stingers", H("stingers", "horror_01_stinger_drum_1_01.ogg"),   0, 3.2, 0.4, -18, 4),
        ("sfx_boss_transform",    "stingers", H("stingers", "horror_01_stinger_synth_1_01.ogg"),  0, 3.6, 0.4, -18, 4),
        ("sfx_boss_defeat",       "stingers", H("stingers", "horror_01_stinger_violin_01.ogg"),   0, 3.2, 0.4, -18, 4),
        ("sfx_player_death",      "stingers", H("stingers", "horror_01_stinger_piano_01.ogg"),    0, 2.3, 0.4, -20, 4),
        # Horror pack, short "glitch" variants used as attack telegraphs
        ("sfx_telegraph_knight",    "sfx", H("stingers", "horror_01_stinger_drum_1_glitch_01.ogg"),  0, 0.80, 0.08, -19, 4),
        ("sfx_telegraph_wraith",    "sfx", H("stingers", "horror_01_stinger_violin_glitch_01.ogg"),  0, 0.65, 0.08, -19, 4),
        ("sfx_telegraph_sovereign", "sfx", H("stingers", "horror_01_stinger_synth_1_glitch_01.ogg"), 0, 0.92, 0.08, -19, 4),
        # Genesis sampler (CC0): combat + UI
        ("sfx_hit_sword",   "sfx", G("sword-hit-01.ogg"),       0, 0.87, 0.05, -20, 4),
        ("sfx_shadow_cast", "sfx", G("fire-spell-cast-01.ogg"), 0, 1.15, 0.08, -20, 4),
        ("sfx_explosion",   "sfx", G("explosion-01.ogg"),       0, 1.99, 0.15, -20, 4),
        ("sfx_heal",        "sfx", G("heal-spell-01.ogg"),      0, 3.45, 0.30, -22, 4),
        ("sfx_gate_open",   "sfx", G("chest-open-01.ogg"),      0, 1.55, 0.10, -21, 4),
        ("ui_confirm",      "ui",  G("menu-confirm-01.ogg"),    0, 0.98, 0.05, -21, 4),
        ("ui_checkpoint",   "ui",  G("quest-accept-01.ogg"),    0, 1.30, 0.08, -21, 4),
        ("sfx_victory",     "ui",  G("quest-complete-01.ogg"),  0, 1.98, 0.15, -20, 4),
        # User-supplied, license unknown (see AUDIO_CREDITS.md). Keep the first 3 pulses + decay.
        ("sfx_boss_rumble", "sfx", a.weird,                     0, 8.0, 0.8,  -20, 4),
    ]
    for name, folder, src, start, dur, fo, rms, q in shots:
        x = seg(decode(src), start, dur)
        x = fade_out(x, fo)
        x, g = level(x, rms)
        jobs.append((name, folder, x, g, q))

    total = 0
    print(f"{'file':34s} {'dur(s)':>7s} {'gain(dB)':>8s} {'KB':>7s}")
    for name, folder, y, g, q in jobs:
        size = encode(y, os.path.join(out, folder, name + ".ogg"), q)
        total += size
        print(f"{folder + '/' + name + '.ogg':34s} {len(y) / SR:7.2f} {g:8.1f} {size / 1024:7.0f}")
    print(f"TOTAL {total / 1024 / 1024:.2f} MB in {len(jobs)} files")


if __name__ == "__main__":
    sys.exit(main())
