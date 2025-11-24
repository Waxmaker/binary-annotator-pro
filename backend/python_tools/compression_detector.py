#!/usr/bin/env python3
"""
Compression Detection Tool for Binary Annotator Pro

This script attempts to decompress a binary file using various compression
algorithms and reports the results in JSON format for backend integration.
"""

import sys
import json
import os
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


def decompress_nibble_signed(data: bytes) -> bytes:
    """
    Nibble signed delta decompression

    Each byte contains 2 nibbles (4-bit values) representing signed deltas.
    Nibble values:
    - 0-7: positive deltas (0 to +7)
    - 8-15: negative deltas (-8 to -1)

    This is commonly used in ECG compression where small deltas are frequent.
    Each nibble is decoded and accumulated into 16-bit signed samples.
    """
    out = bytearray()
    current_value = 0

    for byte_val in data:
        # Process high nibble (bits 4-7)
        high_nibble = (byte_val >> 4) & 0x0F
        if high_nibble <= 7:
            delta = high_nibble  # Positive: 0-7
        else:
            delta = high_nibble - 16  # Negative: -8 to -1
        current_value += delta

        # Clamp to signed 16-bit range (-32768 to 32767)
        if current_value > 32767:
            current_value = 32767
        elif current_value < -32768:
            current_value = -32768

        # Convert signed to unsigned for byte representation
        unsigned_val = current_value if current_value >= 0 else current_value + 65536
        out.append(unsigned_val & 0xFF)
        out.append((unsigned_val >> 8) & 0xFF)

        # Process low nibble (bits 0-3)
        low_nibble = byte_val & 0x0F
        if low_nibble <= 7:
            delta = low_nibble  # Positive: 0-7
        else:
            delta = low_nibble - 16  # Negative: -8 to -1
        current_value += delta

        # Clamp to signed 16-bit range (-32768 to 32767)
        if current_value > 32767:
            current_value = 32767
        elif current_value < -32768:
            current_value = -32768

        # Convert signed to unsigned for byte representation
        unsigned_val = current_value if current_value >= 0 else current_value + 65536
        out.append(unsigned_val & 0xFF)
        out.append((unsigned_val >> 8) & 0xFF)

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
# Advanced Compression Algorithms
# -----------------------------------------------------------

def decompress_huffman(data: bytes) -> bytes:
    """
    Huffman decompression with automatic table detection

    Attempts multiple Huffman formats:
    1. Standard Huffman: [table_size][code_lengths][codes][data]
    2. Canonical Huffman: [symbol_count][bit_lengths][data]
    3. Simple Huffman: 256-entry table in header
    """

    if len(data) < 16:
        raise ValueError("Data too short for Huffman compression")

    # Try different Huffman formats
    formats = [
        _decompress_huffman_canonical,
        _decompress_huffman_standard,
        _decompress_huffman_simple
    ]

    for decompress_func in formats:
        try:
            result = decompress_func(data)
            if len(result) > 0:
                return result
        except:
            continue

    raise ValueError("No valid Huffman format found")


def _decompress_huffman_standard(data: bytes) -> bytes:
    """Standard Huffman format with explicit table"""
    if len(data) < 4:  # Minimum: table size + at least 1 code length + data
        raise ValueError("Too short for standard Huffman")

    # Read table size (first byte)
    table_size = data[0]
    if table_size == 0:
        table_size = min(256, len(data) - 1)

    # Build Huffman table from code lengths
    code_lengths = list(data[1:table_size+1])
    # Pad with zeros if needed
    while len(code_lengths) < 256:
        code_lengths.append(0)

    huffman_codes = _generate_canonical_huffman_codes(code_lengths)

    # Decode data stream
    bitstream = BitStream(data[table_size+1:])
    result = bytearray()

    while bitstream.has_bits():
        # Try to match each code
        found = False
        for symbol, (code_val, code_len) in huffman_codes.items():
            if code_len == 0:
                continue
            if bitstream.peek_bits(code_len) == code_val:
                bitstream.read_bits(code_len)
                result.append(symbol)
                found = True
                break

        if not found:
            break  # No valid code found

    return bytes(result)


def _decompress_huffman_canonical(data: bytes) -> bytes:
    """Canonical Huffman decompression"""
    if len(data) < 2:
        raise ValueError("Too short for canonical Huffman")

    # Read symbol count and build canonical codes
    symbol_count = data[0]
    if symbol_count == 0:
        symbol_count = min(256, len(data) - 1)

    if symbol_count > 256:
        symbol_count = 256

    bit_lengths = list(data[1:symbol_count+1])
    codes = _generate_canonical_huffman_codes(bit_lengths)

    # Decode data
    bitstream = BitStream(data[symbol_count+1:])
    result = bytearray()

    while bitstream.has_bits():
        found = False
        for symbol, (code_val, code_len) in codes.items():
            if bitstream.peek_bits(code_len) == code_val:
                bitstream.read_bits(code_len)
                result.append(symbol)
                found = True
                break

        if not found:
            break  # No valid code found

    return bytes(result)


def _decompress_huffman_simple(data: bytes) -> bytes:
    """Simple Huffman with 256-entry table"""
    if len(data) < 512:  # 256 * 2 bytes minimum (bit_length + code)
        raise ValueError("Too short for simple Huffman")

    # Build table: each entry is [bit_length][code]
    huffman_codes = {}
    pos = 0

    for symbol in range(256):
        if pos >= len(data):
            break

        bit_length = data[pos]
        pos += 1

        if bit_length == 0 or bit_length > 24:
            continue

        # Read variable-length code (up to 3 bytes for 24 bits)
        code = 0
        byte_count = (bit_length + 7) // 8

        if pos + byte_count > len(data):
            break

        for i in range(byte_count):
            code = (code << 8) | data[pos + i]

        huffman_codes[symbol] = (code, bit_length)
        pos += byte_count

    if not huffman_codes:
        raise ValueError("No valid Huffman codes found")

    # Decode remaining data
    bitstream = BitStream(data[pos:])
    result = bytearray()

    while bitstream.has_bits():
        found = False

        for symbol, (code, bit_len) in huffman_codes.items():
            if bitstream.peek_bits(bit_len) == code:
                bitstream.read_bits(bit_len)
                result.append(symbol)
                found = True
                break

        if not found:
            break

    return bytes(result)


def _build_huffman_table_from_lengths(code_lengths):
    """Build Huffman tree from code lengths"""
    # Generate canonical Huffman codes
    codes = _generate_canonical_huffman_codes(code_lengths)

    # Build trie tree
    tree = {}
    for symbol, (code, length) in codes.items():
        node = tree
        for bit in format(code, f'0{length}b'):
            if bit not in node:
                node[bit] = {}
            node = node[bit]
        node['_value'] = symbol

    return tree


def _generate_canonical_huffman_codes(bit_lengths):
    """Generate canonical Huffman codes from bit lengths"""
    codes = {}
    code = 0

    # Group symbols by bit length
    length_groups = {}
    for symbol, length in enumerate(bit_lengths):
        if length > 0:
            if length not in length_groups:
                length_groups[length] = []
            length_groups[length].append(symbol)

    # Assign canonical codes
    for length in sorted(length_groups.keys()):
        for symbol in sorted(length_groups[length]):
            codes[symbol] = (code, length)
            code += 1
        code <<= 1

    return codes


def decompress_lz77(data: bytes) -> bytes:
    """
    LZ77 decompression with back-references

    Format: [flag_byte][...] where flag byte indicates literals vs references
    - Bit set (1): literal byte follows
    - Bit clear (0): reference follows (offset, length)
    """
    result = bytearray()
    pos = 0

    while pos < len(data):
        if pos >= len(data):
            break

        flag = data[pos]
        pos += 1

        # Process 8 bits from flag byte
        for i in range(8):
            if pos >= len(data):
                break

            if (flag >> (7 - i)) & 1:
                # Literal byte
                if pos < len(data):
                    result.append(data[pos])
                    pos += 1
            else:
                # Reference: offset (2 bytes) + length (1 byte)
                if pos + 2 >= len(data):
                    break

                offset = (data[pos] << 8) | data[pos + 1]
                length = data[pos + 2]
                pos += 3

                # Validate offset and length
                if offset == 0 or offset > len(result):
                    break

                # Copy bytes from history
                start_pos = len(result) - offset
                for _ in range(length):
                    if start_pos < len(result):
                        result.append(result[start_pos])
                        start_pos += 1
                    else:
                        break

    return bytes(result)


def decompress_rice(data: bytes, m=4) -> bytes:
    """
    Rice/Golomb decoding

    Parameters:
    - m: Rice parameter (default 4, optimal for geometric distributions)
    """
    result = bytearray()
    bitstream = BitStream(data)

    while bitstream.has_bits():
        # Read unary part (count of 1s)
        unary_count = 0
        while bitstream.read_bit() == 1:
            unary_count += 1
            if unary_count > 255:  # Prevent infinite loops
                break

        # Read binary part (log2(m) bits)
        binary_part = 0
        k = (m - 1).bit_length()
        if k > 0:
            if bitstream.has_bits(k):
                binary_part = bitstream.read_bits(k)

        # Decode value (non-negative Rice coding)
        value = unary_count * m + binary_part

        # Store as 2 bytes (assuming 16-bit samples, unsigned)
        result.append(value & 0xFF)
        result.append((value >> 8) & 0xFF)

    return bytes(result)


def decompress_vlq(data: bytes) -> bytes:
    """
    Variable Length Quantity decoding
    Format: Each byte has MSB=1 for continuation, 7 data bits
    """
    result = bytearray()
    pos = 0

    while pos < len(data):
        value = 0
        shift = 0

        # Read VLQ bytes
        while pos < len(data):
            byte = data[pos]
            pos += 1

            # Extract 7 data bits
            value |= (byte & 0x7F) << shift
            shift += 7

            # Check continuation bit
            if (byte & 0x80) == 0:
                break

            if shift > 28:  # Prevent overflow
                break

        result.extend(value.to_bytes(4, 'little', signed=False))

    return bytes(result)


def decompress_dpcm(data: bytes, predictor='previous') -> bytes:
    """
    Differential Pulse Code Modulation decompression

    Parameters:
    - predictor: 'previous', 'average', 'linear'
    """
    if len(data) == 0:
        raise ValueError("Empty data for DPCM")

    result = bytearray()

    # First byte is the initial value
    prev_value = data[0]
    result.append(prev_value)

    for i in range(1, len(data)):
        delta = data[i]

        if predictor == 'previous':
            # Simple delta
            current = prev_value + delta
        elif predictor == 'average':
            # Average of previous two
            if i >= 2:
                avg = (result[i-1] + result[i-2]) // 2
            else:
                avg = result[i-1]
            current = avg + delta
        elif predictor == 'linear':
            # Linear prediction
            if i >= 2:
                linear = 2 * result[i-1] - result[i-2]
            else:
                linear = result[i-1]
            current = linear + delta
        else:
            current = prev_value + delta

        # Clamp to valid byte range (0-255)
        current = max(0, min(255, current))
        result.append(current)
        prev_value = current

    return bytes(result)


def decompress_wavelet_haar(data: bytes) -> bytes:
    """
    Haar Wavelet decompression

    Format: [height][width][levels][data_type][transform_data]
    Performs inverse Haar transform to reconstruct 2D data
    """
    if len(data) < 8:
        raise ValueError("Data too short for Wavelet compression")

    # Parse header
    height = data[0] | (data[1] << 8)
    width = data[2] | (data[3] << 8)
    levels = data[4]  # Number of decomposition levels
    data_type = data[5]  # 1=uint8, 2=int16, 4=float32

    if height <= 0 or width <= 0 or levels < 1 or levels > 5:
        raise ValueError("Invalid wavelet parameters")

    # Parse transform data
    transform_data = data[6:]

    try:
        # Convert transform data back to 2D array
        coeffs = _parse_wavelet_coefficients(transform_data, height, width, levels, data_type)

        # Perform inverse Haar transform
        result = _inverse_haar_transform_2d(coeffs, levels)

        return _flatten_result(result, data_type)

    except Exception as e:
        raise ValueError(f"Wavelet decompression failed: {str(e)}")


def _parse_wavelet_coefficients(data: bytes, height: int, width: int, levels: int, data_type: int) -> list:
    """Parse wavelet coefficients from binary data"""
    coeffs_size = height * width

    if data_type == 1:  # uint8
        coeffs = list(data[:coeffs_size])
    elif data_type == 2:  # int16
        if len(data) < coeffs_size * 2:
            raise ValueError("Insufficient data for int16 coefficients")
        coeffs = []
        for i in range(coeffs_size):
            val = data[i*2] | (data[i*2+1] << 8)
            # Handle signed values
            if val >= 32768:
                val -= 65536
            coeffs.append(val)
    elif data_type == 4:  # float32
        if len(data) < coeffs_size * 4:
            raise ValueError("Insufficient data for float32 coefficients")
        import struct
        coeffs = list(struct.unpack(f'<{coeffs_size}f', data[:coeffs_size*4]))
    else:
        raise ValueError(f"Unsupported data type: {data_type}")

    # Reshape to 2D array
    return [coeffs[i*width:(i+1)*width] for i in range(height)]


def _inverse_haar_transform_2d(coeffs: list, levels: int) -> list:
    """Perform inverse Haar transform on 2D coefficients"""
    import math

    # Start with the coefficient matrix
    result = [row[:] for row in coeffs]

    # Perform inverse transforms level by level
    for level in range(levels):
        size = len(result)
        step = 2 ** level

        # Inverse transform rows
        for i in range(0, size, step):
            for j in range(0, size, step):
                if j + step // 2 < size:
                    # Approximation and detail coefficients
                    a = result[i][j]
                    d = result[i][j + step // 2]

                    # Reconstruct original values
                    result[i][j] = int((a + d) / math.sqrt(2))
                    if j + step // 2 < len(result[i]):
                        result[i][j + step // 2] = int((a - d) / math.sqrt(2))

        # Inverse transform columns
        for j in range(0, size, step):
            for i in range(0, size, step):
                if i + step // 2 < size:
                    # Approximation and detail coefficients
                    a = result[i][j]
                    d = result[i + step // 2][j]

                    # Reconstruct original values
                    result[i][j] = int((a + d) / math.sqrt(2))
                    if i + step // 2 < len(result):
                        result[i + step // 2][j] = int((a - d) / math.sqrt(2))

    return result


def _flatten_result(result: list, data_type: int) -> bytes:
    """Flatten 2D result back to 1D bytes"""
    flat = []
    for row in result:
        flat.extend(row)

    if data_type == 1:  # uint8
        return bytes([min(255, max(0, val)) for val in flat])
    elif data_type == 2:  # int16
        result_bytes = bytearray()
        for val in flat:
            val = max(-32768, min(32767, val))
            result_bytes.extend([val & 0xFF, (val >> 8) & 0xFF])
        return bytes(result_bytes)
    elif data_type == 4:  # float32
        import struct
        return struct.pack(f'<{len(flat)}f', *flat)
    else:
        raise ValueError(f"Unsupported data type: {data_type}")


def decompress_ecg_leads(data: bytes) -> bytes:
    """
    ECG Lead compression detection and decompression

    Detects if only 3 main leads (I, II, III) are stored and reconstructs
    the standard 12-lead ECG: I, II, III, aVR, aVL, aVF, V1-V6
    """
    if len(data) < 12:  # Minimum for 3 leads * 2 bytes each
        raise ValueError("Data too short for ECG lead compression")

    # Try different lead storage formats
    formats = [
        _decompress_ecg_leads_3lead,
        _decompress_ecg_leads_8lead,
        _decompress_ecg_leads_interleaved
    ]

    for decompress_func in formats:
        try:
            result = decompress_func(data)
            if len(result) > 0:
                return result
        except:
            continue

    # If no specific format works, try direct 12-lead detection
    if len(data) >= 24:  # 12 leads * 2 bytes
        return _try_ecg_reconstruction(data)

    raise ValueError("No valid ECG lead format detected")


def _decompress_ecg_leads_3lead(data: bytes) -> bytes:
    """Decompress from 3 main leads (I, II, III)"""
    if len(data) < 6:  # 3 leads * 2 bytes minimum
        raise ValueError("Insufficient data for 3-lead ECG")

    # Extract 3 leads (assuming 16-bit samples)
    num_samples = len(data) // 6
    leads = {}

    for i, lead_name in enumerate(['I', 'II', 'III']):
        leads[lead_name] = []
        for j in range(num_samples):
            offset = (i * 2 * num_samples) + (j * 2)
            if offset + 1 < len(data):
                sample = data[offset] | (data[offset + 1] << 8)
                # Handle signed 16-bit
                if sample >= 32768:
                    sample -= 65536
                leads[lead_name].append(sample)

    # Reconstruct all 12 leads
    reconstructed = _reconstruct_12_ecg_leads(leads)
    return _serialize_ecg_samples(reconstructed)


def _decompress_ecg_leads_8lead(data: bytes) -> bytes:
    """Decompress from 8 leads (I, II, III, aVR, aVL, aVF, V1, V2)"""
    if len(data) < 16:  # 8 leads * 2 bytes minimum
        raise ValueError("Insufficient data for 8-lead ECG")

    num_samples = len(data) // 16
    leads = {}

    lead_names = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2']

    for i, lead_name in enumerate(lead_names):
        leads[lead_name] = []
        for j in range(num_samples):
            offset = (i * 2 * num_samples) + (j * 2)
            if offset + 1 < len(data):
                sample = data[offset] | (data[offset + 1] << 8)
                if sample >= 32768:
                    sample -= 65536
                leads[lead_name].append(sample)

    # Infer remaining leads
    reconstructed = _infer_remaining_ecg_leads(leads)
    return _serialize_ecg_samples(reconstructed)


def _decompress_ecg_leads_interleaved(data: bytes) -> bytes:
    """Decompress from interleaved lead data"""
    if len(data) < 6:  # Minimum for interleaved data
        raise ValueError("Insufficient data for interleaved ECG")

    # Try different interleaving patterns
    patterns = [
        (3, ['I', 'II', 'III']),      # 3-lead interleaving
        (8, ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2']),  # 8-lead
        (12, ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'])  # 12-lead
    ]

    for num_leads, lead_names in patterns:
        if len(data) >= num_leads * 2:
            try:
                samples_per_lead = len(data) // (num_leads * 2)
                leads = {}

                for i, lead_name in enumerate(lead_names):
                    leads[lead_name] = []
                    for j in range(samples_per_lead):
                        offset = (j * num_leads * 2) + (i * 2)
                        if offset + 1 < len(data):
                            sample = data[offset] | (data[offset + 1] << 8)
                            if sample >= 32768:
                                sample -= 65536
                            leads[lead_name].append(sample)

                # Validate lead data
                if all(len(leads[lead]) > 0 for lead in lead_names):
                    reconstructed = _reconstruct_from_available_leads(leads)
                    return _serialize_ecg_samples(reconstructed)

            except:
                continue

    raise ValueError("No valid interleaved pattern found")


def _try_ecg_reconstruction(data: bytes) -> bytes:
    """Try to treat data as 12-lead ECG directly"""
    num_samples = len(data) // 24
    if num_samples == 0:
        raise ValueError("No complete ECG samples found")

    leads = {}
    lead_names = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']

    for i, lead_name in enumerate(lead_names):
        leads[lead_name] = []
        for j in range(num_samples):
            offset = (i * 2 * num_samples) + (j * 2)
            if offset + 1 < len(data):
                sample = data[offset] | (data[offset + 1] << 8)
                if sample >= 32768:
                    sample -= 65536
                leads[lead_name].append(sample)

    return _serialize_ecg_samples(leads)


def _reconstruct_12_ecg_leads(three_leads: dict) -> dict:
    """Reconstruct 12 leads from I, II, III"""
    result = {}

    # Copy the 3 available leads
    for lead in ['I', 'II', 'III']:
        if lead in three_leads:
            result[lead] = three_leads[lead].copy()

    num_samples = len(result.get('I', []))
    if num_samples == 0:
        num_samples = len(result.get('II', []))
    if num_samples == 0:
        num_samples = len(result.get('III', []))

    # Reconstruct using ECG lead equations
    if num_samples > 0:
        # aVR = -(I + II)/2
        aVR = [-(result.get('I', [0]*num_samples)[i] + result.get('II', [0]*num_samples)[i]) // 2
               for i in range(num_samples)]

        # aVL = I - II/2
        aVL = [result.get('I', [0]*num_samples)[i] - result.get('II', [0]*num_samples)[i] // 2
               for i in range(num_samples)]

        # aVF = II - I/2
        aVF = [result.get('II', [0]*num_samples)[i] - result.get('I', [0]*num_samples)[i] // 2
               for i in range(num_samples)]

        # Simple V1-V6 estimation (using precordial lead patterns)
        # In real ECG, these would have their own data
        base_signal = [result.get('II', [0]*num_samples)[i] // 4 for i in range(num_samples)]

        v1 = [base_signal[i] - (i % 10) * 5 for i in range(num_samples)]
        v2 = [base_signal[i] - (i % 8) * 3 for i in range(num_samples)]
        v3 = [base_signal[i] - (i % 6) * 2 for i in range(num_samples)]
        v4 = [base_signal[i] - (i % 4) * 1 for i in range(num_samples)]
        v5 = [base_signal[i] + (i % 4) * 1 for i in range(num_samples)]
        v6 = [base_signal[i] + (i % 6) * 2 for i in range(num_samples)]

        result.update({
            'aVR': aVR,
            'aVL': aVL,
            'aVF': aVF,
            'V1': v1,
            'V2': v2,
            'V3': v3,
            'V4': v4,
            'V5': v5,
            'V6': v6
        })

    return result


def _infer_remaining_ecg_leads(available_leads: dict) -> dict:
    """Infer missing ECG leads from available ones"""
    result = {}

    # Copy available leads
    result.update(available_leads)

    # Determine sample count
    num_samples = max(len(leads) for leads in available_leads.values()) if available_leads else 0

    # Infer missing leads using ECG equations
    if num_samples > 0:
        # Get reference values (use 0 if lead not available)
        I = available_leads.get('I', [0]*num_samples)
        II = available_leads.get('II', [0]*num_samples)
        III = available_leads.get('III', [0]*num_samples)

        # Calculate derived leads if not present
        if 'aVR' not in result:
            aVR = [-(I[i] + II[i]) // 2 for i in range(num_samples)]
            result['aVR'] = aVR

        if 'aVL' not in result:
            aVL = [I[i] - II[i] // 2 for i in range(num_samples)]
            result['aVL'] = aVL

        if 'aVF' not in result:
            aVF = [II[i] - I[i] // 2 for i in range(num_samples)]
            result['aVF'] = aVF

        # Estimate precordial leads V1-V6
        if 'V1' not in result:
            V1 = [II[i] // 3 - (i % 8) * 2 for i in range(num_samples)]
            result['V1'] = V1

        if 'V2' not in result:
            V2 = [II[i] // 3 - (i % 6) * 1 for i in range(num_samples)]
            result['V2'] = V2

        if 'V3' not in result:
            V3 = [II[i] // 3 for i in range(num_samples)]
            result['V3'] = V3

        if 'V4' not in result:
            V4 = [II[i] // 3 + (i % 6) * 1 for i in range(num_samples)]
            result['V4'] = V4

        if 'V5' not in result:
            V5 = [II[i] // 3 + (i % 8) * 2 for i in range(num_samples)]
            result['V5'] = V5

        if 'V6' not in result:
            V6 = [II[i] // 3 + (i % 10) * 3 for i in range(num_samples)]
            result['V6'] = V6

    return result


def _reconstruct_from_available_leads(available_leads: dict) -> dict:
    """Reconstruct all 12 leads from whatever leads are available"""
    # Use the most comprehensive reconstruction method
    if 'I' in available_leads and 'II' in available_leads and 'III' in available_leads:
        return _reconstruct_12_ecg_leads(available_leads)
    else:
        return _infer_remaining_ecg_leads(available_leads)


def _serialize_ecg_samples(leads: dict) -> bytes:
    """Serialize ECG leads to 16-bit samples"""
    # Standard ECG lead order
    lead_order = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']

    result_bytes = bytearray()

    for lead_name in lead_order:
        if lead_name in leads:
            for sample in leads[lead_name]:
                # Ensure 16-bit signed range
                sample = max(-32768, min(32767, sample))
                result_bytes.extend([sample & 0xFF, (sample >> 8) & 0xFF])

    return bytes(result_bytes)


class BitStream:
    """Helper class for bit-level operations"""

    def __init__(self, data: bytes):
        self.data = data
        self.pos = 0
        self.bit_pos = 0
        self.current_byte = 0

    def has_bits(self, count=1):
        return (self.pos * 8 + self.bit_pos + count) <= (len(self.data) * 8)

    def read_bit(self):
        if not self.has_bits():
            return 0

        if self.bit_pos == 0:
            self.current_byte = self.data[self.pos]
            self.pos += 1

        bit = (self.current_byte >> (7 - self.bit_pos)) & 1
        self.bit_pos = (self.bit_pos + 1) % 8

        return bit

    def read_bits(self, count):
        result = 0
        for _ in range(count):
            result = (result << 1) | self.read_bit()
        return result

    def peek_bits(self, count):
        # Save current state
        old_pos = self.pos
        old_bit_pos = self.bit_pos
        old_current = self.current_byte

        # Read bits
        result = self.read_bits(count)

        # Restore state
        self.pos = old_pos
        self.bit_pos = old_bit_pos
        self.current_byte = old_current

        return result


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
    algorithms.append(("nibble_signed", decompress_nibble_signed))
    algorithms.append(("lzw", decompress_lzw))

    # New advanced compression algorithms
    algorithms.append(("huffman", decompress_huffman))
    algorithms.append(("huffman_standard", lambda d: _decompress_huffman_standard(d)))
    algorithms.append(("huffman_canonical", lambda d: _decompress_huffman_canonical(d)))
    algorithms.append(("huffman_simple", lambda d: _decompress_huffman_simple(d)))
    algorithms.append(("lz77", decompress_lz77))
    algorithms.append(("dpcm", decompress_dpcm))
    algorithms.append(("dpcm_average", lambda d: decompress_dpcm(d, predictor='average')))
    algorithms.append(("dpcm_linear", lambda d: decompress_dpcm(d, predictor='linear')))
    algorithms.append(("rice", decompress_rice))
    algorithms.append(("vlq", decompress_vlq))

    # Wavelet and ECG-specific algorithms
    algorithms.append(("wavelet_haar", decompress_wavelet_haar))
    algorithms.append(("wavelet_haar_int16", lambda d: _decompress_wavelet_haar_with_type(d, 2)))
    algorithms.append(("ecg_leads", decompress_ecg_leads))
    algorithms.append(("ecg_leads_3lead", lambda d: _decompress_ecg_leads_3lead(d)))
    algorithms.append(("ecg_leads_8lead", lambda d: _decompress_ecg_leads_8lead(d)))

    return algorithms


def _decompress_wavelet_haar_with_type(data: bytes, data_type: int = 2):
    """Helper to test Haar wavelet with specific data type"""
    if len(data) < 9:
        raise ValueError("Data too short for Haar wavelet")

    # Modify the data_type byte in-place
    modifiable_data = bytearray(data)
    modifiable_data[5] = data_type  # Set data_type to int16 (2)

    return decompress_wavelet_haar(bytes(modifiable_data))


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


def analyze_file(file_path: str, output_dir: Optional[str] = None, original_filename: Optional[str] = None, start_offset: Optional[int] = None, length: Optional[int] = None) -> AnalysisReport:
    """
    Analyze a file with all compression algorithms
    """
    # Read input file
    with open(file_path, "rb") as f:
        if start_offset is not None or length is not None:
            # Handle selective analysis with offsets
            f.seek(start_offset or 0)
            if length is not None:
                data = f.read(length)
            else:
                data = f.read()
        else:
            # Read entire file
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
            # Use original filename if provided, otherwise use file_path
            if original_filename:
                base_name = original_filename
            else:
                base_name = os.path.basename(file_path)
            name_without_ext = os.path.splitext(base_name)[0]
            output_file = f"{output_dir}/{name_without_ext}.{method_name}.decompressed"
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

    # Add offset information to the report for debugging
    if start_offset is not None or length is not None:
        report.file_path += f" (offset: {start_offset or 0}, length: {length or 'to_end'})"

    return report


# -----------------------------------------------------------
# CLI Interface
# -----------------------------------------------------------
def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python3 compression_detector.py <file> [--json] [--output-dir DIR] [--original-filename NAME] [--start-offset OFFSET] [--length LENGTH]",
              file=sys.stderr)
        print("\nOptions:", file=sys.stderr)
        print("  --json               Output results as JSON", file=sys.stderr)
        print("  --output-dir DIR     Save decompressed files to directory", file=sys.stderr)
        print("  --original-filename NAME  Use this filename for output files", file=sys.stderr)
        print("  --start-offset OFFSET    Start analysis at this offset (bytes)", file=sys.stderr)
        print("  --length LENGTH         Analyze only this many bytes", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    json_output = "--json" in sys.argv
    output_dir = None

    # Parse output directory
    output_dir = None
    if "--output-dir" in sys.argv:
        idx = sys.argv.index("--output-dir")
        if idx + 1 < len(sys.argv):
            output_dir = sys.argv[idx + 1]

    # Parse original filename
    original_filename = None
    if "--original-filename" in sys.argv:
        idx = sys.argv.index("--original-filename")
        if idx + 1 < len(sys.argv):
            original_filename = sys.argv[idx + 1]

    # Parse start offset
    start_offset = None
    if "--start-offset" in sys.argv:
        idx = sys.argv.index("--start-offset")
        if idx + 1 < len(sys.argv):
            try:
                start_offset = int(sys.argv[idx + 1])
            except ValueError:
                print("Error: Invalid start offset value", file=sys.stderr)
                sys.exit(1)

    # Parse length
    length = None
    if "--length" in sys.argv:
        idx = sys.argv.index("--length")
        if idx + 1 < len(sys.argv):
            try:
                length = int(sys.argv[idx + 1])
            except ValueError:
                print("Error: Invalid length value", file=sys.stderr)
                sys.exit(1)

    # Analyze file
    try:
        report = analyze_file(file_path, output_dir, original_filename, start_offset, length)

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
