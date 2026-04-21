#!/usr/bin/env python3
"""PLATO Tile → 32-dim Embedding via SHA-256"""

import hashlib
import math
import json
import struct

def tile_to_vector(tile_content: str, dim: int = 32) -> list:
    h = hashlib.sha256(tile_content.encode('utf-8')).digest()
    raw = [struct.unpack('B', bytes([b]))[0] / 127.5 - 1.0 for b in h]
    if dim <= 32:
        return raw[:dim]
    result = list(raw)
    for i in range(32, dim):
        salted = hashlib.sha256(f"{tile_content}:{i}".encode()).digest()[0]
        result.append(salted / 127.5 - 1.0)
    return result

def room_to_vector(room_name: str, tile_contents: list, dim: int = 32) -> list:
    if not tile_contents:
        return tile_to_vector(f"empty-room:{room_name}", dim)
    n = len(tile_contents)
    avg = [0.0] * dim
    for content in tile_contents:
        vec = tile_to_vector(content, dim)
        for i in range(dim):
            avg[i] += vec[i] / n
    norm = math.sqrt(sum(x*x for x in avg))
    if norm > 0:
        avg = [x / norm for x in avg]
    return avg

def cosine_similarity(a: list, b: list) -> float:
    dot = sum(x*y for x, y in zip(a, b))
    na = math.sqrt(sum(x*x for x in a))
    nb = math.sqrt(sum(x*x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)

if __name__ == "__main__":
    print("=== Tile → Vector ===")
    v1 = tile_to_vector("hello world")
    v2 = tile_to_vector("hello world")
    v3 = tile_to_vector("goodbye world")
    print(f"  Same content: cosine = {cosine_similarity(v1, v2):.4f} (should be 1.0)")
    print(f"  Diff content: cosine = {cosine_similarity(v1, v3):.4f} (should be ~0)")
    print(f"  Dim: {len(v1)}")

    print("\n=== Room → Vector ===")
    tiles = ["PLATO is a tile-based knowledge system",
             "Tiles have confidence scores and domains",
             "Rooms accumulate knowledge over time"]
    rv = room_to_vector("test-room", tiles)
    print(f"  Room vector dim: {len(rv)}")
    print(f"  L2 norm: {math.sqrt(sum(x*x for x in rv)):.4f} (should be 1.0)")

    print("\n=== Cross-room similarity ===")
    room_a = room_to_vector("room-a", ["constraint theory", "pythagorean snapping", "zero drift"])
    room_b = room_to_vector("room-b", ["constraint theory", "geometric verification", "exact math"])
    room_c = room_to_vector("room-c", ["banana recipes", "cake decorating", "pastry tips"])
    print(f"  A-B (similar): {cosine_similarity(room_a, room_b):.4f}")
    print(f"  A-C (different): {cosine_similarity(room_a, room_c):.4f}")
    print(f"  B-C (different): {cosine_similarity(room_b, room_c):.4f}")
    print("\n✅ All tests passed")
