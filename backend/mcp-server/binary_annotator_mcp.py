#!/usr/bin/env python3.13
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "mcp",
#   "httpx",
# ]
# ///
"""
MCP server for Binary Annotator Pro.

Exposes tools to analyze binary files, search patterns, and manage YAML configurations.

Environment:
- BINARY_ANNOTATOR_API_URL (optional): API base URL (default: http://localhost:3000)
"""

from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, List, Optional

import httpx

try:
    from mcp.server.fastmcp import FastMCP
    _FASTMCP_AVAILABLE = True
except Exception:
    _FASTMCP_AVAILABLE = False

if not _FASTMCP_AVAILABLE:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server


# Get API URL from environment or use default
API_BASE_URL = os.getenv("BINARY_ANNOTATOR_API_URL", "http://localhost:3000")


class BinaryAnnotatorClient:
    """Client for Binary Annotator Pro API."""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)

    async def list_binary_files(self) -> List[Dict[str, Any]]:
        """List all binary files."""
        response = await self.client.get(f"{self.base_url}/get/list/binary")
        response.raise_for_status()
        return response.json()

    async def get_binary_file(self, file_name: str) -> bytes:
        """Get binary file content."""
        response = await self.client.get(f"{self.base_url}/get/binary/{file_name}")
        response.raise_for_status()
        return response.content

    async def search_pattern(
        self,
        file_name: str,
        value: str,
        search_type: str = "hex"
    ) -> Dict[str, Any]:
        """Search for a pattern in a binary file."""
        response = await self.client.post(
            f"{self.base_url}/search",
            json={
                "file_name": file_name,
                "value": value,
                "type": search_type
            }
        )
        response.raise_for_status()
        return response.json()

    async def list_yaml_configs(self) -> List[Dict[str, Any]]:
        """List all YAML configurations."""
        response = await self.client.get(f"{self.base_url}/get/list/yaml")
        response.raise_for_status()
        return response.json()

    async def get_yaml_config(self, config_name: str) -> str:
        """Get YAML configuration content."""
        response = await self.client.get(f"{self.base_url}/get/yaml/{config_name}")
        response.raise_for_status()
        return response.text

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


client = BinaryAnnotatorClient(API_BASE_URL)


def format_bytes_hex(data: bytes, offset: int = 0, length: int = 16) -> str:
    """Format bytes as hex dump."""
    lines = []
    for i in range(0, len(data), length):
        chunk = data[i:i+length]
        hex_part = ' '.join(f'{b:02X}' for b in chunk)
        ascii_part = ''.join(chr(b) if 32 <= b <= 126 else '.' for b in chunk)
        lines.append(f"{offset + i:08X}  {hex_part:<48}  {ascii_part}")
    return '\n'.join(lines)


def calculate_entropy(data: bytes) -> float:
    """Calculate Shannon entropy of data."""
    if not data:
        return 0.0

    # Count byte frequencies
    freq = [0] * 256
    for byte in data:
        freq[byte] += 1

    # Calculate entropy
    import math
    entropy = 0.0
    data_len = len(data)
    for count in freq:
        if count > 0:
            p = count / data_len
            entropy -= p * math.log2(p)

    return entropy


# ============================================================================
# MCP Tools Implementation
# ============================================================================

async def _list_binary_files() -> Dict[str, Any]:
    """List all available binary files."""
    files = await client.list_binary_files()
    return {
        "files": files,
        "count": len(files),
        "summary": f"Found {len(files)} binary file(s)"
    }


async def _read_binary_bytes(
    file_name: str,
    offset: int = 0,
    length: int = 256
) -> Dict[str, Any]:
    """Read bytes from a binary file at a specific offset."""
    data = await client.get_binary_file(file_name)

    # Validate offset and length
    if offset < 0 or offset >= len(data):
        return {"error": f"Offset {offset} out of range (file size: {len(data)})"}

    end = min(offset + length, len(data))
    chunk = data[offset:end]

    return {
        "file_name": file_name,
        "offset": offset,
        "length": len(chunk),
        "hex_dump": format_bytes_hex(chunk, offset),
        "bytes": list(chunk),
        "file_size": len(data)
    }


async def _search_pattern(
    file_name: str,
    value: str,
    search_type: str = "hex"
) -> Dict[str, Any]:
    """
    Search for a pattern in a binary file.

    Supported search types:
    - hex: Hex pattern (e.g., "FF 00 AA")
    - string-ascii: ASCII string
    - string-utf8: UTF-8 string
    - int8, uint8: 8-bit integers
    - int16le, int16be, uint16le, uint16be: 16-bit integers
    - int32le, int32be, uint32le, uint32be: 32-bit integers
    - float32le, float32be: 32-bit floats
    - float64le, float64be: 64-bit floats
    - timestamp-unix32, timestamp-unix64: Unix timestamps
    """
    result = await client.search_pattern(file_name, value, search_type)

    matches = result.get("matches", []) if result else []
    count = result.get("count", 0) if result else 0
    return {
        "file_name": file_name,
        "search_value": value,
        "search_type": search_type,
        "matches": matches if matches else [],
        "count": count,
        "summary": f"Found {len(matches) if matches else 0} match(es) for '{value}' ({search_type})"
    }


async def _get_file_info(file_name: str) -> Dict[str, Any]:
    """Get detailed information about a binary file."""
    data = await client.get_binary_file(file_name)

    # Calculate statistics
    file_size = len(data)
    entropy = calculate_entropy(data)

    # Byte frequency analysis
    freq = [0] * 256
    for byte in data:
        freq[byte] += 1

    # Find most common bytes
    most_common = sorted(
        [(i, count) for i, count in enumerate(freq)],
        key=lambda x: x[1],
        reverse=True
    )[:10]

    # Detect null bytes
    null_count = freq[0]
    null_percentage = (null_count / file_size * 100) if file_size > 0 else 0

    return {
        "file_name": file_name,
        "size": file_size,
        "size_kb": round(file_size / 1024, 2),
        "entropy": round(entropy, 4),
        "entropy_analysis": "High (likely compressed/encrypted)" if entropy > 7.5 else "Medium (mixed data)" if entropy > 4 else "Low (structured/repetitive)",
        "null_bytes": null_count,
        "null_percentage": round(null_percentage, 2),
        "most_common_bytes": [
            {"byte": f"0x{byte:02X}", "count": count, "percentage": round(count / file_size * 100, 2)}
            for byte, count in most_common
        ],
        "header_preview": format_bytes_hex(data[:128], 0, 16)
    }


async def _analyze_structure(
    file_name: str,
    block_size: int = 16
) -> Dict[str, Any]:
    """Analyze binary file structure by detecting repeating patterns."""
    data = await client.get_binary_file(file_name)

    # Detect magic bytes (first 4 bytes)
    magic = data[:4] if len(data) >= 4 else data
    magic_hex = ' '.join(f'{b:02X}' for b in magic)

    # Detect possible structures by analyzing entropy in blocks
    blocks = []
    for i in range(0, min(len(data), 1024), block_size):
        chunk = data[i:i+block_size]
        if len(chunk) == block_size:
            entropy = calculate_entropy(chunk)
            blocks.append({
                "offset": i,
                "entropy": round(entropy, 2),
                "type": "high_entropy" if entropy > 7 else "low_entropy"
            })

    return {
        "file_name": file_name,
        "file_size": len(data),
        "magic_bytes": magic_hex,
        "blocks_analyzed": len(blocks),
        "entropy_map": blocks,
        "summary": f"Analyzed {len(blocks)} blocks of {block_size} bytes each"
    }


async def _list_yaml_configs() -> Dict[str, Any]:
    """List all available YAML configurations."""
    configs = await client.list_yaml_configs()
    return {
        "configs": configs,
        "count": len(configs),
        "summary": f"Found {len(configs)} YAML configuration(s)"
    }


async def _get_yaml_config(config_name: str) -> Dict[str, Any]:
    """Get YAML configuration content."""
    yaml_content = await client.get_yaml_config(config_name)
    return {
        "config_name": config_name,
        "content": yaml_content,
        "lines": len(yaml_content.split('\n')),
        "size": len(yaml_content)
    }


# ============================================================================
# Advanced Analysis Tools
# ============================================================================

async def _extract_strings(
    file_name: str,
    min_length: int = 4,
    encoding: str = "ascii"
) -> Dict[str, Any]:
    """Extract printable strings from binary file."""
    data = await client.get_binary_file(file_name)

    strings_found = []
    current_string = []
    current_offset = 0

    for i, byte in enumerate(data):
        if encoding == "ascii":
            if 32 <= byte <= 126:  # Printable ASCII
                if not current_string:
                    current_offset = i
                current_string.append(chr(byte))
            else:
                if len(current_string) >= min_length:
                    strings_found.append({
                        "offset": current_offset,
                        "string": ''.join(current_string),
                        "length": len(current_string)
                    })
                current_string = []

    # Don't forget last string
    if len(current_string) >= min_length:
        strings_found.append({
            "offset": current_offset,
            "string": ''.join(current_string),
            "length": len(current_string)
        })

    return {
        "file_name": file_name,
        "encoding": encoding,
        "min_length": min_length,
        "strings_found": len(strings_found),
        "strings": strings_found[:100],  # Limit to first 100
        "summary": f"Found {len(strings_found)} strings (showing first 100)"
    }


async def _find_repeating_patterns(
    file_name: str,
    pattern_size: int = 4,
    min_occurrences: int = 3
) -> Dict[str, Any]:
    """Find repeating byte patterns in the file."""
    data = await client.get_binary_file(file_name)

    if len(data) < pattern_size:
        return {"error": "File too small for pattern analysis"}

    # Dictionary to count patterns
    patterns: Dict[bytes, List[int]] = {}

    # Scan through file
    for i in range(len(data) - pattern_size + 1):
        pattern = bytes(data[i:i+pattern_size])
        if pattern not in patterns:
            patterns[pattern] = []
        patterns[pattern].append(i)

    # Filter patterns that repeat enough times
    repeating = [
        {
            "pattern": ' '.join(f'{b:02X}' for b in pattern),
            "occurrences": len(offsets),
            "offsets": offsets[:20]  # Limit offsets shown
        }
        for pattern, offsets in patterns.items()
        if len(offsets) >= min_occurrences
    ]

    # Sort by occurrence count
    repeating.sort(key=lambda x: x["occurrences"], reverse=True)

    return {
        "file_name": file_name,
        "pattern_size": pattern_size,
        "min_occurrences": min_occurrences,
        "repeating_patterns_found": len(repeating),
        "patterns": repeating[:50],  # Top 50 patterns
        "summary": f"Found {len(repeating)} repeating patterns (showing top 50)"
    }


async def _byte_frequency_analysis(file_name: str) -> Dict[str, Any]:
    """Detailed byte frequency analysis."""
    data = await client.get_binary_file(file_name)

    freq = [0] * 256
    for byte in data:
        freq[byte] += 1

    file_size = len(data)

    # Create frequency distribution
    distribution = []
    for i in range(256):
        if freq[i] > 0:
            distribution.append({
                "byte": f"0x{i:02X}",
                "ascii": chr(i) if 32 <= i <= 126 else ".",
                "count": freq[i],
                "percentage": round(freq[i] / file_size * 100, 3)
            })

    # Sort by frequency
    distribution.sort(key=lambda x: x["count"], reverse=True)

    # Calculate statistics
    unique_bytes = sum(1 for count in freq if count > 0)

    return {
        "file_name": file_name,
        "file_size": file_size,
        "unique_bytes": unique_bytes,
        "byte_diversity": round(unique_bytes / 256 * 100, 2),
        "frequency_distribution": distribution,
        "top_10": distribution[:10],
        "summary": f"File uses {unique_bytes}/256 possible byte values"
    }


async def _extract_integers(
    file_name: str,
    offset: int = 0,
    length: int = 256,
    int_type: str = "int32le"
) -> Dict[str, Any]:
    """Extract integers from binary data."""
    data = await client.get_binary_file(file_name)

    if offset >= len(data):
        return {"error": "Offset beyond file size"}

    chunk = data[offset:offset+length]

    import struct

    # Map int types to struct format
    format_map = {
        "int8": ("b", 1),
        "uint8": ("B", 1),
        "int16le": ("<h", 2),
        "int16be": (">h", 2),
        "uint16le": ("<H", 2),
        "uint16be": (">H", 2),
        "int32le": ("<i", 4),
        "int32be": (">i", 4),
        "uint32le": ("<I", 4),
        "uint32be": (">I", 4),
        "int64le": ("<q", 8),
        "int64be": (">q", 8),
    }

    if int_type not in format_map:
        return {"error": f"Unknown int type: {int_type}"}

    fmt, size = format_map[int_type]

    values = []
    for i in range(0, len(chunk) - size + 1, size):
        try:
            value = struct.unpack(fmt, chunk[i:i+size])[0]
            values.append({
                "offset": offset + i,
                "value": value,
                "hex": f"0x{value & ((1 << (size*8)) - 1):0{size*2}X}"
            })
        except struct.error:
            break

    return {
        "file_name": file_name,
        "offset": offset,
        "int_type": int_type,
        "values_extracted": len(values),
        "values": values,
        "summary": f"Extracted {len(values)} {int_type} values from offset {offset}"
    }


async def _extract_floats(
    file_name: str,
    offset: int = 0,
    length: int = 256,
    float_type: str = "float32le"
) -> Dict[str, Any]:
    """Extract floating point numbers from binary data."""
    data = await client.get_binary_file(file_name)

    if offset >= len(data):
        return {"error": "Offset beyond file size"}

    chunk = data[offset:offset+length]

    import struct

    format_map = {
        "float32le": ("<f", 4),
        "float32be": (">f", 4),
        "float64le": ("<d", 8),
        "float64be": (">d", 8),
    }

    if float_type not in format_map:
        return {"error": f"Unknown float type: {float_type}"}

    fmt, size = format_map[float_type]

    values = []
    for i in range(0, len(chunk) - size + 1, size):
        try:
            value = struct.unpack(fmt, chunk[i:i+size])[0]
            values.append({
                "offset": offset + i,
                "value": round(value, 6),
            })
        except struct.error:
            break

    return {
        "file_name": file_name,
        "offset": offset,
        "float_type": float_type,
        "values_extracted": len(values),
        "values": values,
        "summary": f"Extracted {len(values)} {float_type} values from offset {offset}"
    }


async def _detect_timestamps(
    file_name: str,
    offset: int = 0,
    length: int = 1024
) -> Dict[str, Any]:
    """Detect Unix timestamps in binary data."""
    data = await client.get_binary_file(file_name)

    if offset >= len(data):
        return {"error": "Offset beyond file size"}

    chunk = data[offset:offset+length]

    import struct
    from datetime import datetime

    timestamps_found = []

    # Check for 32-bit Unix timestamps (1970-2038 range)
    for i in range(0, len(chunk) - 4 + 1, 4):
        try:
            # Try little-endian
            ts_le = struct.unpack("<I", chunk[i:i+4])[0]
            if 0 < ts_le < 2147483647:  # Valid Unix timestamp range
                try:
                    dt = datetime.fromtimestamp(ts_le)
                    if 1990 < dt.year < 2040:  # Reasonable date range
                        timestamps_found.append({
                            "offset": offset + i,
                            "timestamp": ts_le,
                            "endian": "little",
                            "date": dt.isoformat(),
                            "type": "unix32"
                        })
                except:
                    pass
        except struct.error:
            pass

    return {
        "file_name": file_name,
        "offset": offset,
        "timestamps_found": len(timestamps_found),
        "timestamps": timestamps_found,
        "summary": f"Found {len(timestamps_found)} potential timestamps"
    }


async def _compare_files(
    file1: str,
    file2: str,
    max_differences: int = 100
) -> Dict[str, Any]:
    """Compare two binary files and show differences."""
    data1 = await client.get_binary_file(file1)
    data2 = await client.get_binary_file(file2)

    size1 = len(data1)
    size2 = len(data2)

    differences = []
    min_size = min(size1, size2)

    for i in range(min_size):
        if data1[i] != data2[i]:
            differences.append({
                "offset": i,
                "file1_byte": f"0x{data1[i]:02X}",
                "file2_byte": f"0x{data2[i]:02X}",
            })
            if len(differences) >= max_differences:
                break

    return {
        "file1": file1,
        "file2": file2,
        "file1_size": size1,
        "file2_size": size2,
        "size_difference": abs(size1 - size2),
        "bytes_compared": min_size,
        "differences_found": len(differences),
        "differences": differences,
        "identical": len(differences) == 0 and size1 == size2,
        "summary": f"Found {len(differences)} differences in first {min_size} bytes"
    }


async def _find_null_blocks(
    file_name: str,
    min_size: int = 16
) -> Dict[str, Any]:
    """Find continuous blocks of null bytes (padding)."""
    data = await client.get_binary_file(file_name)

    null_blocks = []
    in_block = False
    block_start = 0

    for i, byte in enumerate(data):
        if byte == 0x00:
            if not in_block:
                block_start = i
                in_block = True
        else:
            if in_block:
                block_size = i - block_start
                if block_size >= min_size:
                    null_blocks.append({
                        "offset": block_start,
                        "size": block_size,
                        "end_offset": i - 1
                    })
                in_block = False

    # Check last block
    if in_block:
        block_size = len(data) - block_start
        if block_size >= min_size:
            null_blocks.append({
                "offset": block_start,
                "size": block_size,
                "end_offset": len(data) - 1
            })

    total_null_bytes = sum(block["size"] for block in null_blocks)

    return {
        "file_name": file_name,
        "file_size": len(data),
        "min_block_size": min_size,
        "null_blocks_found": len(null_blocks),
        "total_null_bytes": total_null_bytes,
        "null_percentage": round(total_null_bytes / len(data) * 100, 2) if len(data) > 0 else 0,
        "blocks": null_blocks,
        "summary": f"Found {len(null_blocks)} null blocks totaling {total_null_bytes} bytes"
    }


async def _detect_compression(file_name: str) -> Dict[str, Any]:
    """Detect potential compressed data sections."""
    data = await client.get_binary_file(file_name)

    # Check for common compression signatures
    signatures = {
        "gzip": (b"\x1f\x8b\x08", "GZIP compressed data"),
        "zlib": (b"\x78\x9c", "zlib compressed data (default)"),
        "zlib_best": (b"\x78\xda", "zlib compressed data (best)"),
        "zlib_fast": (b"\x78\x01", "zlib compressed data (fast)"),
        "zip": (b"PK\x03\x04", "ZIP archive"),
        "bzip2": (b"BZ", "BZIP2 compressed data"),
        "lzma": (b"\x5d\x00\x00", "LZMA compressed data"),
        "xz": (b"\xfd7zXZ\x00", "XZ compressed data"),
    }

    detections = []

    for name, (sig, desc) in signatures.items():
        offset = 0
        while True:
            pos = data.find(sig, offset)
            if pos == -1:
                break
            detections.append({
                "type": name,
                "description": desc,
                "offset": pos,
                "signature": ' '.join(f'{b:02X}' for b in sig)
            })
            offset = pos + 1

    # High entropy blocks likely indicate compression
    high_entropy_blocks = []
    block_size = 256
    for i in range(0, len(data), block_size):
        chunk = data[i:i+block_size]
        if len(chunk) == block_size:
            entropy = calculate_entropy(chunk)
            if entropy > 7.5:
                high_entropy_blocks.append({
                    "offset": i,
                    "size": block_size,
                    "entropy": round(entropy, 2)
                })

    return {
        "file_name": file_name,
        "compression_signatures_found": len(detections),
        "signatures": detections,
        "high_entropy_blocks": len(high_entropy_blocks),
        "entropy_blocks": high_entropy_blocks[:20],
        "summary": f"Found {len(detections)} compression signatures and {len(high_entropy_blocks)} high-entropy blocks"
    }


# ============================================================================
# MCP Server Setup
# ============================================================================

if _FASTMCP_AVAILABLE:
    app = FastMCP('binary-annotator-pro')

    @app.tool()
    async def list_binary_files() -> Dict[str, Any]:
        """
        List all available binary files in the database.

        Returns a list of files with their names, sizes, and metadata.
        """
        return await _list_binary_files()

    @app.tool()
    async def read_binary_bytes(
        file_name: str,
        offset: int = 0,
        length: int = 256
    ) -> Dict[str, Any]:
        """
        Read bytes from a binary file at a specific offset.

        Args:
            file_name: Name of the binary file to read
            offset: Starting offset (default: 0)
            length: Number of bytes to read (default: 256)

        Returns hex dump, byte array, and file information.
        """
        return await _read_binary_bytes(file_name, offset, length)

    @app.tool()
    async def search_pattern(
        file_name: str,
        value: str,
        search_type: str = "hex"
    ) -> Dict[str, Any]:
        """
        Search for a pattern in a binary file.

        Args:
            file_name: Name of the binary file to search
            value: Value to search for (format depends on search_type)
            search_type: Type of search (hex, string-ascii, int16le, etc.)

        Returns all matching offsets and their lengths.
        """
        return await _search_pattern(file_name, value, search_type)

    @app.tool()
    async def get_file_info(file_name: str) -> Dict[str, Any]:
        """
        Get detailed information about a binary file.

        Args:
            file_name: Name of the binary file

        Returns file size, entropy, byte frequency analysis, and header preview.
        """
        return await _get_file_info(file_name)

    @app.tool()
    async def analyze_structure(
        file_name: str,
        block_size: int = 16
    ) -> Dict[str, Any]:
        """
        Analyze binary file structure by detecting patterns and entropy.

        Args:
            file_name: Name of the binary file
            block_size: Size of blocks to analyze (default: 16)

        Returns magic bytes, entropy map, and structural analysis.
        """
        return await _analyze_structure(file_name, block_size)

    @app.tool()
    async def list_yaml_configs() -> Dict[str, Any]:
        """
        List all available YAML configurations.

        Returns a list of saved YAML configs with their metadata.
        """
        return await _list_yaml_configs()

    @app.tool()
    async def get_yaml_config(config_name: str) -> Dict[str, Any]:
        """
        Get the content of a YAML configuration.

        Args:
            config_name: Name of the YAML configuration

        Returns the YAML content and metadata.
        """
        return await _get_yaml_config(config_name)

    @app.tool()
    async def extract_strings(
        file_name: str,
        min_length: int = 4,
        encoding: str = "ascii"
    ) -> Dict[str, Any]:
        """
        Extract printable strings from a binary file.

        Args:
            file_name: Name of the binary file
            min_length: Minimum string length (default: 4)
            encoding: Encoding type (ascii, unicode)

        Returns all printable strings found with their offsets.
        """
        return await _extract_strings(file_name, min_length, encoding)

    @app.tool()
    async def find_repeating_patterns(
        file_name: str,
        pattern_size: int = 4,
        min_occurrences: int = 3
    ) -> Dict[str, Any]:
        """
        Find repeating byte patterns in the binary file.

        Args:
            file_name: Name of the binary file
            pattern_size: Size of pattern to search for (default: 4 bytes)
            min_occurrences: Minimum number of occurrences (default: 3)

        Returns repeating patterns with their offsets and occurrence counts.
        """
        return await _find_repeating_patterns(file_name, pattern_size, min_occurrences)

    @app.tool()
    async def byte_frequency_analysis(file_name: str) -> Dict[str, Any]:
        """
        Perform detailed byte frequency analysis on a binary file.

        Args:
            file_name: Name of the binary file

        Returns byte frequency distribution and statistics.
        """
        return await _byte_frequency_analysis(file_name)

    @app.tool()
    async def extract_integers(
        file_name: str,
        offset: int = 0,
        length: int = 256,
        int_type: str = "int32le"
    ) -> Dict[str, Any]:
        """
        Extract integer values from binary data.

        Args:
            file_name: Name of the binary file
            offset: Starting offset (default: 0)
            length: Number of bytes to analyze (default: 256)
            int_type: Integer type (int8, uint8, int16le, int16be, int32le, etc.)

        Returns extracted integer values with their offsets.
        """
        return await _extract_integers(file_name, offset, length, int_type)

    @app.tool()
    async def extract_floats(
        file_name: str,
        offset: int = 0,
        length: int = 256,
        float_type: str = "float32le"
    ) -> Dict[str, Any]:
        """
        Extract floating point numbers from binary data.

        Args:
            file_name: Name of the binary file
            offset: Starting offset (default: 0)
            length: Number of bytes to analyze (default: 256)
            float_type: Float type (float32le, float32be, float64le, float64be)

        Returns extracted float values with their offsets.
        """
        return await _extract_floats(file_name, offset, length, float_type)

    @app.tool()
    async def detect_timestamps(
        file_name: str,
        offset: int = 0,
        length: int = 1024
    ) -> Dict[str, Any]:
        """
        Detect Unix timestamps in binary data.

        Args:
            file_name: Name of the binary file
            offset: Starting offset (default: 0)
            length: Number of bytes to analyze (default: 1024)

        Returns potential timestamps with human-readable dates.
        """
        return await _detect_timestamps(file_name, offset, length)

    @app.tool()
    async def compare_files(
        file1: str,
        file2: str,
        max_differences: int = 100
    ) -> Dict[str, Any]:
        """
        Compare two binary files byte-by-byte.

        Args:
            file1: Name of the first file
            file2: Name of the second file
            max_differences: Maximum number of differences to report (default: 100)

        Returns list of byte differences between the files.
        """
        return await _compare_files(file1, file2, max_differences)

    @app.tool()
    async def find_null_blocks(
        file_name: str,
        min_size: int = 16
    ) -> Dict[str, Any]:
        """
        Find continuous blocks of null bytes (padding/empty space).

        Args:
            file_name: Name of the binary file
            min_size: Minimum block size to report (default: 16)

        Returns null byte blocks with their offsets and sizes.
        """
        return await _find_null_blocks(file_name, min_size)

    @app.tool()
    async def detect_compression(file_name: str) -> Dict[str, Any]:
        """
        Detect compressed data sections and compression algorithms.

        Args:
            file_name: Name of the binary file

        Returns detected compression signatures and high-entropy blocks.
        """
        return await _detect_compression(file_name)

    if __name__ == '__main__':
        app.run()

else:
    # Fallback to low-level API
    server = Server('binary-annotator-pro')

    @server.tool()
    async def list_binary_files() -> Dict[str, Any]:
        """List all available binary files."""
        return await _list_binary_files()

    @server.tool()
    async def read_binary_bytes(
        file_name: str,
        offset: int = 0,
        length: int = 256
    ) -> Dict[str, Any]:
        """Read bytes from a binary file at a specific offset."""
        return await _read_binary_bytes(file_name, offset, length)

    @server.tool()
    async def search_pattern(
        file_name: str,
        value: str,
        search_type: str = "hex"
    ) -> Dict[str, Any]:
        """Search for a pattern in a binary file."""
        return await _search_pattern(file_name, value, search_type)

    @server.tool()
    async def get_file_info(file_name: str) -> Dict[str, Any]:
        """Get detailed information about a binary file."""
        return await _get_file_info(file_name)

    @server.tool()
    async def analyze_structure(
        file_name: str,
        block_size: int = 16
    ) -> Dict[str, Any]:
        """Analyze binary file structure."""
        return await _analyze_structure(file_name, block_size)

    @server.tool()
    async def list_yaml_configs() -> Dict[str, Any]:
        """List all YAML configurations."""
        return await _list_yaml_configs()

    @server.tool()
    async def get_yaml_config(config_name: str) -> Dict[str, Any]:
        """Get YAML configuration content."""
        return await _get_yaml_config(config_name)

    async def _main() -> None:
        async with stdio_server() as (read, write):
            await server.run(read, write)

    if __name__ == '__main__':
        asyncio.run(_main())
