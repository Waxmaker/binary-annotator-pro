#!/usr/bin/env python3
"""
Compression Detection Tool for Binary Annotator Pro

This script attempts to decompress a binary file using various compression
algorithms and reports the results in JSON format for backend integration.
"""

import sys
import json
import zlib
import gzip
import bz2
import lzma
import struct
import math
import hashlib
from typing import Dict, List, Optional, Tuple, Callable
from dataclasses import dataclass, asdict

# Optional compression libraries
try:
    import lz4.frame
    HAS_LZ4 = True
except ImportError:
    HAS_LZ4 = False

try:
    import zstandard as zstd
    HAS_ZSTD = True
except ImportError:
    HAS_ZSTD = False

try:
    import brotli
    HAS_BROTLI = True
except ImportError:
    HAS_BROTLI = False

try:
    import snappy
    HAS_SNAPPY = True
except ImportError:
    HAS_SNAPPY = False


# -----------------------------------------------------------
# Data Models
# -----------------------------------------------------------
@dataclass
class DecompressionResult:
    """Result of a single decompression attempt"""
    method: str
    success: bool
    decompressed_size: int
    original_size: int
    compression_ratio: float  # decompressed / original
    confidence: float  # 0.0 to 1.0
    entropy_original: float
    entropy_decompressed: float
    checksum_valid: bool
    validation_msg: str
    error: Optional[str] = None
    decompressed_data: Optional[bytes] = None

    def to_json(self) -> dict:
        """Convert to JSON-serializable dict (without binary data)"""
        result = asdict(self)
        result.pop('decompressed_data', None)  # Remove binary data
        return result


@dataclass
class AnalysisReport:
    """Complete analysis report"""
    file_path: str
    file_size: int
    total_tests: int
    success_count: int
    failed_count: int
    best_method: Optional[str]
    best_ratio: float
    best_confidence: float
    results: List[DecompressionResult]

    def to_json(self) -> dict:
        """Convert to JSON"""
        data = asdict(self)
        data['results'] = [r.to_json() for r in self.results]
        return data


# -----------------------------------------------------------
# Entropy Calculation
# -----------------------------------------------------------
def calculate_entropy(data: bytes) -> float:
    """Calculate Shannon entropy of data"""
    if len(data) == 0:
        return 0.0

    # Count byte frequencies
    frequencies = [0] * 256
    for byte in data:
        frequencies[byte] += 1

    # Calculate entropy
    entropy = 0.0
    for freq in frequencies:
        if freq > 0:
            probability = freq / len(data)
            entropy -= probability * math.log2(probability)

    return entropy


# -----------------------------------------------------------
# Validation Functions
# -----------------------------------------------------------
def validate_decompressed_data(data: bytes, original_size: int) -> Tuple[bool, str]:
    """
    Validate decompressed data using heuristics
    Returns (is_valid, message)
    """
    if len(data) == 0:
        return False, "Empty output"

    # Check for reasonable size expansion
    ratio = len(data) / original_size if original_size > 0 else 0
    if ratio > 100:
        return False, f"Suspicious expansion ratio: {ratio:.1f}x"

    if ratio < 0.5:
        return False, f"Suspicious compression ratio: {ratio:.2f}x"

    # Check entropy - decompressed data should have lower entropy than compressed
    entropy = calculate_entropy(data)
    if entropy < 1.0:
        return False, f"Entropy too low: {entropy:.2f}"

    # Check for null bytes domination (might indicate invalid decompression)
    null_count = data.count(b'\x00')
    null_ratio = null_count / len(data)
    if null_ratio > 0.95:
        return False, f"Too many null bytes: {null_ratio*100:.1f}%"

    return True, "Validation passed"


def calculate_confidence(result: DecompressionResult) -> float:
    """
    Calculate confidence score for a decompression result
    Based on multiple factors: entropy, ratio, validation, etc.
    """
    if not result.success:
        return 0.0

    score = 0.0

    # Factor 1: Compression ratio (typical range 1.5x to 10x)
    if 1.5 <= result.compression_ratio <= 10.0:
        score += 0.3
    elif 1.2 <= result.compression_ratio <= 15.0:
        score += 0.15

    # Factor 2: Entropy difference (decompressed should have lower entropy)
    entropy_diff = result.entropy_original - result.entropy_decompressed
    if entropy_diff > 1.0:
        score += 0.3
    elif entropy_diff > 0.5:
        score += 0.15

    # Factor 3: Validation passed
    if result.checksum_valid:
        score += 0.2

    # Factor 4: Reasonable decompressed size
    if 1000 <= result.decompressed_size <= 100_000_000:
        score += 0.2

    return min(1.0, score)


# -----------------------------------------------------------
# Simple Compression Algorithms
# -----------------------------------------------------------
def decompress_rle(data: bytes) -> bytes:
    """
    Simple Run-Length Encoding decompression
    Format: [count][byte][count][byte]...
    """
    out = bytearray()
    i = 0
    while i < len(data) - 1:
        count = data[i]
        value = data[i + 1]
        if count == 0:
            count = 256  # Special case
        out.extend([value] * count)
        i += 2
    return bytes(out)


def decompress_delta(data: bytes) -> bytes:
    """
    Delta encoding decompression
    Each byte is added to accumulator
    """
    out = bytearray()
    acc = 0
    for b in data:
        acc = (acc + b) & 0xFF
        out.append(acc)
    return bytes(out)


def decompress_delta_signed(data: bytes) -> bytes:
    """
    Signed delta encoding (for ECG signals)
    """
    out = bytearray()
    acc = 0
    for b in data:
        # Interpret as signed byte
        delta = b if b < 128 else b - 256
        acc = (acc + delta) & 0xFFFF  # 16-bit accumulator for ECG
        out.append(acc & 0xFF)
        out.append((acc >> 8) & 0xFF)
    return bytes(out)


def decompress_lzw(data: bytes) -> bytes:
    """
    Simple LZW decompression
    """
    dict_size = 256
    dictionary = {i: bytes([i]) for i in range(dict_size)}
    result = bytearray()

    code_stream = list(data)
    if not code_stream:
        return b''

    w = bytes([code_stream.pop(0)])
    result.extend(w)

    for k in code_stream:
        if k in dictionary:
            entry = dictionary[k]
        elif k == dict_size:
            entry = w + w[:1]
        else:
            raise ValueError(f"Invalid LZW code: {k}")

        result.extend(entry)
        dictionary[dict_size] = w + entry[:1]
        dict_size += 1
        w = entry

    return bytes(result)


# -----------------------------------------------------------
# Algorithm Registry
# -----------------------------------------------------------
def get_algorithms() -> List[Tuple[str, Callable[[bytes], bytes]]]:
    """
    Returns list of (name, decompression_function) tuples
    """
    algorithms = []

    # Standard compression algorithms
    algorithms.append(("zlib", lambda d: zlib.decompress(d)))
    algorithms.append(("gzip", lambda d: gzip.decompress(d)))
    algorithms.append(("bz2", lambda d: bz2.decompress(d)))
    algorithms.append(("lzma", lambda d: lzma.decompress(d)))
    algorithms.append(("deflate", lambda d: zlib.decompress(d, -zlib.MAX_WBITS)))

    # Optional modern algorithms
    if HAS_LZ4:
        algorithms.append(("lz4", lambda d: lz4.frame.decompress(d)))

    if HAS_ZSTD:
        algorithms.append(("zstd", lambda d: zstd.ZstdDecompressor().decompress(d)))

    if HAS_BROTLI:
        algorithms.append(("brotli", lambda d: brotli.decompress(d)))

    if HAS_SNAPPY:
        algorithms.append(("snappy", lambda d: snappy.decompress(d)))

    # Simple/custom algorithms
    algorithms.append(("rle", decompress_rle))
    algorithms.append(("delta", decompress_delta))
    algorithms.append(("delta_signed", decompress_delta_signed))
    algorithms.append(("lzw", decompress_lzw))

    return algorithms


# -----------------------------------------------------------
# Main Detection Logic
# -----------------------------------------------------------
def test_decompression(data: bytes, method_name: str,
                       decompress_func: Callable[[bytes], bytes]) -> DecompressionResult:
    """
    Test a single decompression method
    """
    original_size = len(data)
    entropy_original = calculate_entropy(data)

    try:
        # Attempt decompression
        decompressed = decompress_func(data)
        decompressed_size = len(decompressed)

        # Calculate metrics
        compression_ratio = decompressed_size / original_size if original_size > 0 else 0
        entropy_decompressed = calculate_entropy(decompressed)

        # Validate
        checksum_valid, validation_msg = validate_decompressed_data(decompressed, original_size)

        # Create result
        result = DecompressionResult(
            method=method_name,
            success=True,
            decompressed_size=decompressed_size,
            original_size=original_size,
            compression_ratio=compression_ratio,
            confidence=0.0,  # Will calculate after
            entropy_original=entropy_original,
            entropy_decompressed=entropy_decompressed,
            checksum_valid=checksum_valid,
            validation_msg=validation_msg,
            decompressed_data=decompressed
        )

        # Calculate confidence score
        result.confidence = calculate_confidence(result)

        return result

    except Exception as e:
        return DecompressionResult(
            method=method_name,
            success=False,
            decompressed_size=0,
            original_size=original_size,
            compression_ratio=0.0,
            confidence=0.0,
            entropy_original=entropy_original,
            entropy_decompressed=0.0,
            checksum_valid=False,
            validation_msg="Decompression failed",
            error=str(e)
        )


def analyze_file(file_path: str, output_dir: Optional[str] = None) -> AnalysisReport:
    """
    Analyze a file with all compression algorithms
    """
    # Read input file
    with open(file_path, "rb") as f:
        data = f.read()

    file_size = len(data)
    algorithms = get_algorithms()
    results = []

    # Test each algorithm
    for method_name, decompress_func in algorithms:
        result = test_decompression(data, method_name, decompress_func)
        results.append(result)

        # Save decompressed file if successful and output dir specified
        if result.success and output_dir and result.decompressed_data:
            output_file = f"{file_path}.{method_name}.decompressed"
            try:
                with open(output_file, "wb") as f:
                    f.write(result.decompressed_data)
            except Exception as e:
                print(f"Warning: Could not save {output_file}: {e}", file=sys.stderr)

    # Find best result
    successful_results = [r for r in results if r.success and r.checksum_valid]
    best_method = None
    best_ratio = 0.0
    best_confidence = 0.0

    if successful_results:
        # Sort by confidence, then by ratio
        best = max(successful_results, key=lambda r: (r.confidence, r.compression_ratio))
        best_method = best.method
        best_ratio = best.compression_ratio
        best_confidence = best.confidence

    # Create report
    report = AnalysisReport(
        file_path=file_path,
        file_size=file_size,
        total_tests=len(results),
        success_count=sum(1 for r in results if r.success),
        failed_count=sum(1 for r in results if not r.success),
        best_method=best_method,
        best_ratio=best_ratio,
        best_confidence=best_confidence,
        results=results
    )

    return report


# -----------------------------------------------------------
# CLI Interface
# -----------------------------------------------------------
def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python3 compression_detector.py <file> [--json] [--output-dir DIR]",
              file=sys.stderr)
        print("\nOptions:", file=sys.stderr)
        print("  --json           Output results as JSON", file=sys.stderr)
        print("  --output-dir     Save decompressed files to directory", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    json_output = "--json" in sys.argv
    output_dir = None

    # Parse output directory
    if "--output-dir" in sys.argv:
        idx = sys.argv.index("--output-dir")
        if idx + 1 < len(sys.argv):
            output_dir = sys.argv[idx + 1]

    # Analyze file
    try:
        report = analyze_file(file_path, output_dir)

        if json_output:
            # Output JSON for backend integration
            print(json.dumps(report.to_json(), indent=2))
        else:
            # Human-readable output
            print(f"\n{'='*60}")
            print(f"Compression Detection Report")
            print(f"{'='*60}")
            print(f"File: {report.file_path}")
            print(f"Size: {report.file_size:,} bytes")
            print(f"Tests: {report.total_tests} total, "
                  f"{report.success_count} succeeded, {report.failed_count} failed")

            if report.best_method:
                print(f"\n🏆 Best Method: {report.best_method}")
                print(f"   Ratio: {report.best_ratio:.2f}x")
                print(f"   Confidence: {report.best_confidence:.1%}")

            print(f"\n{'='*60}")
            print(f"{'Method':<20} {'Status':<10} {'Ratio':<10} {'Confidence':<12}")
            print(f"{'='*60}")

            for result in report.results:
                status = "✓ SUCCESS" if result.success else "✗ FAILED"
                ratio = f"{result.compression_ratio:.2f}x" if result.success else "-"
                confidence = f"{result.confidence:.1%}" if result.success else "-"

                print(f"{result.method:<20} {status:<10} {ratio:<10} {confidence:<12}")

                if result.success and not result.checksum_valid:
                    print(f"  ⚠ {result.validation_msg}")

            print(f"{'='*60}\n")

    except FileNotFoundError:
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
