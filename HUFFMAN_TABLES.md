# Huffman Tables Feature

This feature allows you to create, manage, and use Huffman coding tables to decode binary data selections in the hex viewer.

## Overview

Huffman coding is a variable-length prefix coding algorithm commonly used for data compression. This feature enables you to:

1. Create custom Huffman tables with symbol-to-code-length mappings
2. Store these tables in the database for reuse
3. Apply them to decode binary selections in the hex viewer
4. Export decoded results to files

## Creating a Huffman Table

### Method 1: Via the Hex Viewer Context Menu

1. Right-click anywhere in the hex viewer
2. Click "Huffman decode"
3. In the dialog, click "Manage Tables"
4. Click "Create New Table"

### Method 2: Direct Access (if implemented in UI)

Navigate to the Huffman table manager directly from the settings or tools menu.

## Editing a Huffman Table

You can modify existing tables to refine your Huffman codes:

1. Open the Huffman Table Manager
2. Click the **Edit** icon (pencil) next to the table you want to modify
3. Update the name, description, or entries as needed
4. Click **Update Table** to save changes

**Note:** Editing a table will regenerate all Huffman codes based on the new symbol-length mappings.

### Table Format

A Huffman table consists of:
- **Name**: Unique identifier (e.g., `table_fukuda`)
- **Description**: Optional description of the table's purpose
- **Entries**: Symbol-to-code-length mappings

Each entry specifies:
- **Symbol**: The numeric value (e.g., 3, 4, 255)
- **Code Length**: The bit length of the Huffman code (e.g., 1, 2, 8)

### Example Table

```
Name: table_fukuda
Description: Huffman table for Fukuda ECG device

Entries:
Symbol  Code Length
3       1
4       2
5       3
0       4
1       4
2       4
```

### Paste from Clipboard

You can quickly create a table by pasting data from your clipboard:

1. Copy data in the format:
   ```
   sym   len
   3     1
   4     2
   5     3
   ```
2. Click "Paste from Clipboard" in the table creation dialog
3. The system will automatically parse and populate the entries

Comments (lines starting with `#`) and headers (lines containing "sym") are automatically ignored.

## Using a Huffman Table

1. **Select bytes** in the hex viewer (click and drag)
2. **Right-click** on the selection
3. Choose **"Huffman decode"** from the context menu
4. In the dialog:
   - Select a Huffman table from the dropdown
   - Optionally adjust the bit offset (0-7) if decoding doesn't start at a byte boundary
   - Click **"Decode"**

### Bit Offset

The bit offset allows you to start decoding from a specific bit within the first byte:
- `0`: Start from the most significant bit (default)
- `1-7`: Skip that many bits before starting decoding

This is useful when the Huffman-encoded data doesn't align with byte boundaries.

## Exporting Decoded Data

After decoding:

1. Review the decoded symbols in the dialog
2. Click **"Export"** to save the results
3. The file will be named automatically: `huffman_<original_filename>.txt`
4. Each decoded symbol appears on a new line

Example export:
```
3
4
3
5
0
1
2
```

## Technical Details

### Canonical Huffman Code Generation

The system uses canonical Huffman coding to generate the actual binary codes from the symbol-code length pairs:

1. Entries are sorted by code length, then by symbol value
2. Codes are assigned sequentially, incrementing for each new symbol
3. When code length increases, the code is left-shifted

This ensures unique prefix-free codes and efficient decoding.

### Decoding Algorithm

The decoder:
1. Reads bits sequentially from the selected bytes
2. Builds a code string bit by bit
3. Checks if the current code matches any symbol
4. When a match is found, outputs the symbol and resets
5. Continues until all selected bytes are processed

### API Endpoints

**Backend API:**
- `POST /huffman/tables` - Create a new table
- `GET /huffman/tables` - List all tables
- `GET /huffman/tables/:id` - Get table by ID (with entries)
- `GET /huffman/tables/name/:name` - Get table by name
- `PUT /huffman/tables/:id` - Update an existing table
- `DELETE /huffman/tables/:id` - Delete a table
- `POST /huffman/decode` - Decode a binary selection

**Request format for decoding:**
```json
{
  "table_id": 1,
  "file_id": 5,
  "offset": 1024,
  "length": 256,
  "bit_offset": 0
}
```

**Response format:**
```json
{
  "table_name": "table_fukuda",
  "decoded": [3, 4, 3, 5, 0, 1, 2],
  "count": 7
}
```

## Use Cases

### ECG Data Decompression

Many ECG devices use Huffman coding to compress waveform data:
1. Identify the compressed region in the binary file
2. Reverse-engineer or obtain the Huffman table from documentation
3. Create the table in Binary Annotator Pro
4. Select the compressed region
5. Decode using the table
6. Export for further analysis

### Proprietary Format Analysis

When analyzing unknown binary formats:
1. Look for patterns suggesting variable-length encoding
2. Analyze byte distributions and entropy
3. Create test tables based on frequency analysis
4. Iterate on table definitions until meaningful data emerges

### Data Recovery

If you have partial documentation showing symbol frequencies or code lengths:
1. Create the table from available information
2. Apply to suspected compressed regions
3. Validate output against known data patterns

## Troubleshooting

**Empty decode results:**
- Check that the bit offset is correct
- Verify the table entries match the encoding scheme
- Ensure you've selected the correct byte range

**Unexpected symbols:**
- The table may not match the actual encoding
- Try different bit offsets (0-7)
- Verify symbol values are correct

**Incomplete decoding:**
- The selection may be truncated
- Some bits at the end may not form a complete code
- This is normal if the data length isn't a multiple of code lengths

## Database Schema

### Tables

**huffman_tables**
- `id`: Primary key
- `name`: Unique table name
- `description`: Optional description
- `created_at`, `updated_at`, `deleted_at`: Timestamps

**huffman_table_entries**
- `id`: Primary key
- `table_id`: Foreign key to huffman_tables
- `symbol`: Integer symbol value
- `code_length`: Bit length of code
- `code`: Generated binary code string (e.g., "101")
- `created_at`: Timestamp

## Future Enhancements

Potential improvements:
- Import tables from JSON/CSV files
- Auto-generate tables from frequency analysis
- Visual tree representation of Huffman codes
- Support for adaptive/dynamic Huffman coding
- Batch decode multiple selections
- Integration with compression detection
