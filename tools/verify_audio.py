#!/usr/bin/env python3
"""Checks the *encoded* files: decode, peaks, loop seams, near-duplicates, total size."""
import glob, os, subprocess, sys, tempfile, itertools
import numpy as np
from scipy.io import wavfile
from scipy.signal import stft

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "audio"))
LOOPS = ["ambience/amb_exploration", "ambience/amb_dread", "music/music_boss"]
SR = 44100
# Calibrated on the source packs: the known duplicate (stinger_piano vs stinger_piano_ring_mod,
# identical performance + ring-mod) scores 0.83; same-family variants score 0.2-0.7.
# 0.80 therefore catches true duplicates only; pairs at 0.6-0.8 still deserve a listen.
DUP_THRESHOLD = 0.80
ok = True
def fail(msg):
    global ok; ok = False; print("  FAIL:", msg)

def dec(p):
    with tempfile.TemporaryDirectory() as td:
        t = os.path.join(td, "x.wav")
        subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",p,"-ac","2","-ar",str(SR),"-c:a","pcm_f32le",t],check=True)
        return wavfile.read(t)[1].astype(np.float32)

files = sorted(glob.glob(ROOT + "/**/*.ogg", recursive=True))
total = sum(os.path.getsize(f) for f in files)
print(f"{len(files)} ogg files, {total/1024/1024:.2f} MB total")
if total > 30 * 1024 * 1024: fail("over 30 MB")
fp = {}
for f in files:
    x = dec(f); rel = os.path.relpath(f, ROOT)[:-4]
    pk = 20*np.log10(np.abs(x).max()+1e-9)
    if np.abs(x).max() >= 0.999: fail(f"{rel} clips")
    if len(x) < SR*0.3: fail(f"{rel} suspiciously short")
    # lead silence (dead air delays one-shots)
    env = np.abs(x).max(axis=1); lead = np.argmax(env > 10**(-40/20))/SR
    print(f"  {rel:32s} {len(x)/SR:6.2f}s peak {pk:6.1f} dBFS lead-silence {lead*1000:5.0f} ms")
    if lead > 0.05 and rel not in LOOPS: print(f"    note: {lead*1000:.0f} ms of leading quiet")
    f_, t_, Z = stft(x.mean(1), SR, nperseg=2048); M = np.log10(np.abs(Z)+1e-6).mean(1); fp[rel] = (M - M.mean())/ (M.std()+1e-9)

print("loop seams (decoded ogg played back-to-back):")
def rms_db(a): return 20*np.log10(np.sqrt((a**2).mean())+1e-9)
for rel in LOOPS:
    x = dec(f"{ROOT}/{rel}.ogg"); y = np.concatenate([x, x]); s = len(x)
    w = int(0.05*SR)
    # (a) 50 ms windows touching the seam must sit inside the file's own normal range (p1..p99)
    wins = np.array([rms_db(x[i:i+w]) for i in range(0, len(x)-w, w)])
    lo, hi = np.percentile(wins, 1), np.percentile(wins, 99)
    seam_w = [rms_db(y[s-2*w+i*w : s-2*w+(i+1)*w]) for i in range(4)]
    inside = all(lo-0.5 <= v <= hi+0.5 for v in seam_w)
    # (b) no click: biggest sample-to-sample jump at the seam vs the file's normal jumps
    step = np.abs(np.diff(y, axis=0)).max(axis=1)
    seam_step = step[s-3:s+2].max(); p999 = np.percentile(step[:s-100], 99.9)
    # (c) crossfade region (first 4 s / 2 bars) has no hole: 0.5 s windows vs the rest of the file
    cw = int(0.5*SR); xf = [rms_db(x[i:i+cw]) for i in range(0, 4*SR, cw)]; rest = [rms_db(x[i:i+cw]) for i in range(8*SR, len(x)-cw, cw)]
    hole = np.median(rest) - min(xf)
    print(f"  {rel:24s} seam windows {[round(float(v),1) for v in seam_w]} normal range [{lo:.1f}, {hi:.1f}] dB | seam step {seam_step:.4f} (p99.9 {p999:.4f}) | crossfade hole {hole:.1f} dB")
    if not inside: fail(f"{rel} seam level outside normal range")
    if seam_step > max(3*p999, 0.02): fail(f"{rel} click at seam")
    if hole > 3.0: fail(f"{rel} level hole inside crossfade region ({hole:.1f} dB)")

print("near-duplicate check (log-spectrogram shape, time-normalised):")
def tf(x, bins=48, frames=40):
    """Log-spectrogram on a fixed grid, with the shared overall tilt/decay removed
    (double-centred) so only what is *distinctive* about a sound is compared."""
    f_, t_, Z = stft(x.mean(1), SR, nperseg=2048, noverlap=1536); M = np.log10(np.abs(Z)+1e-5)
    edges = np.geomspace(30, 16000, bins+1)
    fb = np.array([M[(f_>=edges[i])&(f_<edges[i+1])].mean(0) if ((f_>=edges[i])&(f_<edges[i+1])).any() else np.zeros(M.shape[1]) for i in range(bins)])
    fb = fb[:, np.linspace(0, fb.shape[1]-1, frames).astype(int)]
    fb = fb - fb.mean(1, keepdims=True)      # remove per-frequency average (spectral tilt)
    fb = fb - fb.mean(0, keepdims=True)      # remove per-frame average (overall decay)
    v = fb.ravel(); return v/(np.linalg.norm(v)+1e-9)
tfp = {os.path.relpath(f, ROOT)[:-4]: tf(dec(f)) for f in files}
pairs = sorted(((float(np.dot(tfp[a],tfp[b])), a, b) for a,b in itertools.combinations(tfp,2)), reverse=True)
for c,a,b in pairs[:5]: print(f"  {c:.2f}  {a}  ~  {b}")
for c,a,b in pairs:
    if c > DUP_THRESHOLD: fail(f"{a} ~ {b} (similarity {c:.2f})")
print("RESULT:", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
