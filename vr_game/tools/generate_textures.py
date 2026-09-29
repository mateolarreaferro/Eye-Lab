"""Generates deterministic, seamless-tileable PBR texture maps (albedo,
roughness, normal) for the 5 city surface materials.

Why synthesized rather than fetched: no CC0 texture-site API endpoint was
verified working from this environment, and guessing at URLs risks wasted
time for no real benefit here -- this is a class-project game asset, not a
photoreal deliverable. Deterministic generation is also more reproducible:
anyone on the team can re-run this with no network dependency and get the
exact same result.

Pure numpy/PIL/scipy, no Blender needed. Run once (or whenever textures
need tweaking) before generate_city.py:
    python3 vr_game/tools/generate_textures.py

generate_city.py loads the resulting PNGs at import time.
"""

import os

import numpy as np
from PIL import Image
from scipy.ndimage import zoom
from scipy.spatial import cKDTree

SIZE = 1024
OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "environment", "textures"))
os.makedirs(OUT_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Shared building blocks
# ---------------------------------------------------------------------------
def seamless_value_noise(seed, size=SIZE, base_cells=6, octaves=4, persistence=0.55):
    """Multi-octave value noise, wrapped at each octave's grid so the
    upsampled result tiles seamlessly at the target size."""
    rng = np.random.RandomState(seed)
    result = np.zeros((size, size), dtype=np.float64)
    amplitude, total_amp, cells = 1.0, 0.0, base_cells
    for _ in range(octaves):
        grid = rng.rand(cells, cells)
        grid = np.pad(grid, ((0, 1), (0, 1)), mode="wrap")  # wrap edge so it tiles
        layer = zoom(grid, size / grid.shape[0], order=1, mode="wrap")[:size, :size]
        result += layer * amplitude
        total_amp += amplitude
        amplitude *= persistence
        cells *= 2
    return result / total_amp  # 0..1


def seamless_voronoi(seed, size=SIZE, n_cells=24):
    """Cell id + distance-to-edge fields, seamless via a 3x3 tiled point set."""
    rng = np.random.RandomState(seed)
    pts = rng.rand(n_cells, 2)
    tiled = []
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            tiled.append(pts + np.array([dx, dy]))
    tiled = np.concatenate(tiled, axis=0) * size
    tree = cKDTree(tiled)
    ys, xs = np.mgrid[0:size, 0:size]
    query = np.stack([xs.ravel(), ys.ravel()], axis=-1).astype(np.float64)
    dist, idx = tree.query(query, k=2)
    d1 = dist[:, 0].reshape(size, size)
    d2 = dist[:, 1].reshape(size, size)
    cell_id = (idx[:, 0] % (n_cells)).reshape(size, size)
    edge_dist = (d2 - d1).reshape(size, size)
    return cell_id, edge_dist / edge_dist.max()


def height_to_normal(height, strength=2.0):
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
    nx, ny, nz = -dx, -dy, np.ones_like(height)
    length = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    nx, ny, nz = nx / length, ny / length, nz / length
    rgb = np.stack([nx * 0.5 + 0.5, ny * 0.5 + 0.5, nz * 0.5 + 0.5], axis=-1)
    return (np.clip(rgb, 0, 1) * 255).astype(np.uint8)


def save_rgb(arr01, path):
    Image.fromarray((np.clip(arr01, 0, 1) * 255).astype(np.uint8)).save(path)


def save_gray_as_rgb(arr01, path):
    g = np.clip(arr01, 0, 1)
    Image.fromarray((np.stack([g, g, g], axis=-1) * 255).astype(np.uint8)).save(path)


def tint(albedo01, color):
    return albedo01 * np.array(color).reshape(1, 1, 3)


def write_set(name, albedo01, roughness01, height01, normal_strength=2.0):
    save_rgb(albedo01, os.path.join(OUT_DIR, f"{name}_albedo.png"))
    save_gray_as_rgb(roughness01, os.path.join(OUT_DIR, f"{name}_roughness.png"))
    normal = height_to_normal(height01, strength=normal_strength)
    Image.fromarray(normal).save(os.path.join(OUT_DIR, f"{name}_normal.png"))
    print(f"wrote {name}_{{albedo,roughness,normal}}.png")


# ---------------------------------------------------------------------------
# Material generators
# ---------------------------------------------------------------------------
def make_stucco():
    h = seamless_value_noise(1, base_cells=6, octaves=5, persistence=0.5)
    stain = seamless_value_noise(2, base_cells=4, octaves=3, persistence=0.6)
    grey = 0.55 + 0.45 * h[..., None]
    albedo = tint(grey, (1.0, 0.97, 0.9)) * (0.9 - 0.15 * stain[..., None])
    roughness = np.clip(0.78 + 0.15 * h - 0.05 * stain, 0.55, 0.97)
    write_set("stucco", albedo, roughness, h, normal_strength=1.0)


def make_brick():
    brick_w, brick_h, mortar = 64, 28, 4
    ys, xs = np.mgrid[0:SIZE, 0:SIZE]
    row = ys // brick_h
    offset = (row % 2) * (brick_w // 2)
    col = (xs + offset) // brick_w
    in_mortar = ((xs + offset) % brick_w < mortar) | (ys % brick_h < mortar)
    rng = np.random.RandomState(3)
    brick_ids = (row.astype(np.int64) * 9973 + col.astype(np.int64) * 613) % 4096
    shade_lut = rng.uniform(0.75, 1.15, size=4096)
    per_brick_shade = shade_lut[brick_ids]
    fine = seamless_value_noise(4, base_cells=32, octaves=3, persistence=0.5)
    base = per_brick_shade * (0.9 + 0.2 * fine)
    albedo = tint(base[..., None], (0.62, 0.27, 0.18))
    albedo[in_mortar] = np.array([0.55, 0.52, 0.48]) * (0.8 + 0.3 * fine[in_mortar])[..., None]
    height = np.where(in_mortar, 0.2, 0.6 + 0.3 * fine)
    roughness = np.where(in_mortar, 0.9, np.clip(0.7 + 0.15 * fine, 0.55, 0.92))
    write_set("brick_terracotta", albedo, roughness, height, normal_strength=3.0)


def make_cobblestone():
    cell_id, edge = seamless_voronoi(5, n_cells=40)
    rng = np.random.RandomState(6)
    shade_lut = rng.uniform(0.6, 1.1, size=40)
    per_cell_shade = shade_lut[cell_id]
    fine = seamless_value_noise(7, base_cells=16, octaves=3, persistence=0.5)
    joint = edge < 0.06
    base = per_cell_shade * (0.85 + 0.25 * fine)
    albedo = tint(base[..., None], (0.5, 0.47, 0.42))
    albedo[joint] = np.array([0.18, 0.16, 0.14]) * (0.8 + 0.3 * fine[joint])[..., None]
    height = np.where(joint, 0.1, 0.5 + 0.4 * edge)
    roughness = np.where(joint, 0.95, np.clip(0.75 + 0.15 * fine, 0.6, 0.95))
    write_set("cobblestone", albedo, roughness, height, normal_strength=3.5)


def make_roof_tile():
    tile_w = 48
    ys, xs = np.mgrid[0:SIZE, 0:SIZE]
    row = ys // 32
    phase = (row % 2) * (tile_w / 2.0)
    curve = 0.5 + 0.5 * np.sin(2 * np.pi * (xs + phase) / tile_w)
    row_band = (ys % 32) / 32.0
    ridge = np.exp(-((row_band - 0.15) ** 2) / 0.01)  # bright highlight near each tile's curve peak
    fine = seamless_value_noise(8, base_cells=20, octaves=3, persistence=0.5)
    base_shade = 0.7 + 0.25 * curve + 0.15 * ridge
    albedo = tint(base_shade[..., None], (0.62, 0.28, 0.16)) * (0.92 + 0.15 * fine[..., None])
    height = 0.3 + 0.5 * curve + 0.2 * ridge
    roughness = np.clip(0.55 + 0.2 * (1.0 - curve) + 0.1 * fine, 0.4, 0.85)
    write_set("roof_tile", albedo, roughness, height, normal_strength=2.5)


def make_canal_stone():
    cell_id, edge = seamless_voronoi(9, n_cells=16)
    rng = np.random.RandomState(10)
    shade_lut = rng.uniform(0.65, 1.05, size=16)
    per_cell_shade = shade_lut[cell_id]
    fine = seamless_value_noise(11, base_cells=12, octaves=4, persistence=0.55)
    joint = edge < 0.05
    base = per_cell_shade * (0.85 + 0.2 * fine)
    albedo = tint(base[..., None], (0.62, 0.6, 0.55))
    albedo[joint] = np.array([0.25, 0.24, 0.22]) * (0.8 + 0.3 * fine[joint])[..., None]
    # subtle darker weathering streaks, tileable (not tied to a specific
    # water edge since this map is reused across many different objects)
    streak = seamless_value_noise(12, base_cells=3, octaves=2, persistence=0.6)
    albedo = albedo * (0.9 + 0.15 * streak[..., None])
    height = np.where(joint, 0.15, 0.55 + 0.35 * edge)
    roughness = np.where(joint, 0.9, np.clip(0.6 + 0.2 * fine, 0.45, 0.85))
    write_set("canal_stone", albedo, roughness, height, normal_strength=2.8)


if __name__ == "__main__":
    make_stucco()
    make_brick()
    make_cobblestone()
    make_roof_tile()
    make_canal_stone()
    print(f"All textures written to {OUT_DIR}")
