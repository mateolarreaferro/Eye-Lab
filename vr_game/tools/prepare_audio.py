"""Turn raw recordings into the WAV assets the SATIE scene compiles.

    python3 vr_game/tools/prepare_audio.py <raw_dir>

<raw_dir> holds the files listed in audio/SOURCES.md (Satie library downloads
and ElevenLabs generations). Output goes to vr_game/audio/assets/. Needs
ffmpeg on PATH plus numpy.

SATIE's portable runtime plays PCM as-is: one shared sample rate, mono for
positioned sounds, no normalisation and no loop crossfade. So this script does
that work up front: trims silence, matches levels, bakes an equal-power
crossfade into every loop.
"""
import pathlib
import subprocess
import sys
import wave

import numpy as np

RATE = 44100
OUT = pathlib.Path(__file__).resolve().parent.parent / "audio" / "assets"


def decode(path, channels=1, start=0.0, length=None):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start), "-i", str(path)]
    if length:
        cmd += ["-t", str(length)]
    cmd += ["-f", "f32le", "-ac", str(channels), "-ar", str(RATE), "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, channels).copy()


def write(name, x):
    x = np.clip(x, -1.0, 1.0)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((x * 32767).round().astype("<i2").tobytes())
    print(f"{name:18s} {x.shape[1]}ch {len(x) / RATE:5.2f}s peak {20 * np.log10(np.abs(x).max()):6.1f} dBFS")


def rms_db(x):
    return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)


def loop(x, seconds, fade=1.5, rms_target=-24.0):
    """Cut `seconds` + fade, then fold the tail over the head with an
    equal-power crossfade so the loop point is inaudible."""
    n, f = int(seconds * RATE), int(fade * RATE)
    x = x[: n + f]
    t = np.linspace(0, np.pi / 2, f)[:, None]
    body = x[:n].copy()
    body[:f] = x[:f] * np.sin(t) + x[n : n + f] * np.cos(t)
    body *= 10 ** ((rms_target - rms_db(body)) / 20)
    return body * min(1.0, 10 ** (-1.0 / 20) / np.abs(body).max())  # keep 1 dB headroom


def event(x, peak_db=-3.0, floor_db=-45.0, max_len=None, tail=0.05):
    """Trim leading/trailing silence, short fade out, peak-normalise."""
    env = np.abs(x).max(axis=1)
    thresh = env.max() * 10 ** (floor_db / 20)
    idx = np.nonzero(env > thresh)[0]
    x = x[max(idx[0] - int(0.003 * RATE), 0) : idx[-1] + 1]
    if max_len:
        x = x[: int(max_len * RATE)]
    f = min(int(tail * RATE), len(x))
    x[-f:] *= np.linspace(1, 0, f)[:, None]
    return x * 10 ** (peak_db / 20) / np.abs(x).max()


def main(raw):
    raw = pathlib.Path(raw)
    lib = lambda n: raw / f"lib-{n}.src"

    # Beds and loops. The canal's second variant is the same seamless loop
    # rotated by half its length, so neighbouring canal emitters never align.
    write("town_air", loop(decode(raw / "gen-town.mp3", 2), 22, rms_target=-26))
    canal = loop(decode(raw / "gen-canal.mp3"), 20)
    write("canal_a", canal)
    write("canal_b", np.roll(canal, len(canal) // 2, axis=0))
    write("fountain", loop(decode(raw / "gen-fountain.mp3"), 18))
    write("terrace", loop(decode(raw / "gen-terrace.mp3"), 20))

    # Events
    for i in range(3):
        write(f"step_{i}", event(decode(raw / f"gen-step-{i + 1}.mp3"), max_len=0.4))
    for i, n in enumerate(["songbird-chirping-call", "forest-bird-call", "forest-bird-call-2"]):
        write(f"bird_{i}", event(decode(lib(n)), max_len=2.5))
    write("pigeon_0", event(decode(raw / "gen-pigeon-1.mp3")))
    write("pigeon_1", event(decode(raw / "gen-pigeon-2.mp3")))
    write("gull_0", event(decode(raw / "gen-gull-1.mp3")))
    write("gull_1", event(decode(raw / "gen-gull-2.mp3")))
    write("bell", event(decode(raw / "gen-bell.mp3"), floor_db=-55, tail=0.5))
    write("dog", event(decode(raw / "gen-dog.mp3")))
    # Eye Lab's own "complete" tone, so the VR game shares the desktop app's sound family.
    write("arrive", event(decode(raw / "eyelab-complete.wav"), peak_db=-6))


if __name__ == "__main__":
    main(sys.argv[1])
