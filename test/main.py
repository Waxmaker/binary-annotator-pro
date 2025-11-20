#!/usr/bin/env python3
import zlib
import gzip
import bz2
import lzma
import binascii
import os

# Optional modules
try:
    import lz4.frame
except:
    lz4 = None

try:
    import zstandard as zstd
except:
    zstd = None

try:
    import brotli
except:
    brotli = None

try:
    import snappy
except:
    snappy = None


# -----------------------------------------------------------
# Helpers for simple algorithms (RLE, delta)
# -----------------------------------------------------------
def try_rle(data):
    out = bytearray()
    i = 0
    while i < len(data):
        if i + 1 >= len(data):
            raise ValueError("Invalid RLE")
        count = data[i]
        value = data[i + 1]
        out.extend([value] * count)
        i += 2
    return bytes(out)


def try_delta(data):
    out = bytearray()
    acc = 0
    for b in data:
        acc = (acc + b) & 0xFF
        out.append(acc)
    return bytes(out)


# -----------------------------------------------------------
# LZW (minimal)
# -----------------------------------------------------------
def try_lzw(data):
    dict_size = 256
    dictionary = {i: bytes([i]) for i in range(dict_size)}
    result = bytearray()

    code_stream = list(data)
    w = bytes([code_stream.pop(0)])

    for k in code_stream:
        if k in dictionary:
            entry = dictionary[k]
        elif k == dict_size:
            entry = w + w[:1]
        else:
            raise ValueError("Invalid LZW code")

        result.extend(entry)

        dictionary[dict_size] = w + entry[:1]
        dict_size += 1
        w = entry

    return bytes(result)


# -----------------------------------------------------------
# Main test logic
# -----------------------------------------------------------
ALGORITHMS = []

# STANDARD COMPRESSION
ALGORITHMS.append(("zlib", lambda d: zlib.decompress(d)))
ALGORITHMS.append(("gzip", lambda d: gzip.decompress(d)))
ALGORITHMS.append(("bz2", lambda d: bz2.decompress(d)))
ALGORITHMS.append(("lzma", lambda d: lzma.decompress(d)))

# OPTIONAL
if lz4:
    ALGORITHMS.append(("lz4", lambda d: lz4.frame.decompress(d)))

if zstd:
    ALGORITHMS.append(
        ("zstd", lambda d: zstd.ZstdDecompressor().decompress(d)))

if brotli:
    ALGORITHMS.append(("brotli", lambda d: brotli.decompress(d)))

if snappy:
    ALGORITHMS.append(("snappy", lambda d: snappy.decompress(d)))

# SIMPLE CODINGS
ALGORITHMS.append(("RLE", try_rle))
ALGORITHMS.append(("Delta", try_delta))
ALGORITHMS.append(("LZW", try_lzw))


# -----------------------------------------------------------
# Runner
# -----------------------------------------------------------
def test_algorithms(path):
    with open(path, "rb") as f:
        data = f.read()

    print(f"[+] Loaded file: {path} ({len(data)} bytes)\n")

    for name, func in ALGORITHMS:
        print(f"[*] Testing {name} ...")
        try:
            out = func(data)
            size = len(out)

            print(f"    ✔ SUCCESS – output size: {size} bytes")

            out_path = f"{path}.{name}.decoded"
            with open(out_path, "wb") as w:
                w.write(out)
            print(f"    → Written to: {out_path}\n")

        except Exception as e:
            print(f"    ✘ Failed: {e}\n")


# -----------------------------------------------------------
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 test_compression_algos.py FILE.ECG")
        exit(1)

    test_algorithms(sys.argv[1])
