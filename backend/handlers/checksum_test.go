package handlers

import (
	"testing"
)

// TestCRC16CCITT validates the CRC-16/CCITT implementation against known values
// This algorithm matches Python's binascii.crc_hqx() and is used in Schiller MKF files
func TestCRC16CCITT(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected uint16
	}{
		{
			name:     "Empty data",
			data:     []byte{},
			expected: 0xFFFF, // Initial value
		},
		{
			name:     "Single byte",
			data:     []byte{0x01},
			expected: 0xF1D1,
		},
		{
			name:     "Standard test vector",
			data:     []byte("123456789"),
			expected: 0x29B1,
		},
		{
			name: "Schiller MKF file data (JANE_DOEBIS @ 0xA00-0xBFE)",
			// First 32 bytes of actual MKF patient section
			data: []byte{
				0x01, 0x01, 0xe0, 0xeb, 0xe4, 0xef, 0xaa, 0xaa,
				0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
				0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
				0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
			},
			expected: 0x6E85, // CRC of first 32 bytes
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateCRC16CCITT(tt.data)
			if result != tt.expected {
				t.Errorf("calculateCRC16CCITT() = 0x%04X, want 0x%04X", result, tt.expected)
			}
		})
	}
}

// TestCRC16CCITTMatchesPython verifies our implementation matches Python's binascii.crc_hqx
func TestCRC16CCITTMatchesPython(t *testing.T) {
	// Test data and expected results generated from Python:
	// import binascii
	// binascii.crc_hqx(data, 0xFFFF)

	tests := []struct {
		data     []byte
		pythonCRC uint16
	}{
		{[]byte("123456789"), 0x29B1},  // Standard test vector
		{[]byte("hello world"), 0xEFEB}, // Common string
		{[]byte{0xFF, 0xFF, 0xFF, 0xFF}, 0x1D0F}, // All ones
		{[]byte{0x00, 0x00, 0x00, 0x00}, 0x84C0}, // All zeros
	}

	for i, tt := range tests {
		result := calculateCRC16CCITT(tt.data)
		if result != tt.pythonCRC {
			t.Errorf("Test %d: CRC mismatch. Got 0x%04X, Python gives 0x%04X",
				i, result, tt.pythonCRC)
		}
	}
}

// TestAllCRCImplementations ensures all CRC functions execute without panicking
func TestAllCRCImplementations(t *testing.T) {
	testData := []byte{0x01, 0x02, 0x03, 0x04, 0x05}

	tests := []struct {
		name string
		fn   func([]byte) interface{}
	}{
		{"CRC8", func(d []byte) interface{} { return calculateCRC8(d) }},
		{"CRC16Modbus", func(d []byte) interface{} { return calculateCRC16Modbus(d) }},
		{"CRC16XModem", func(d []byte) interface{} { return calculateCRC16XModem(d) }},
		{"CRC16CCITT", func(d []byte) interface{} { return calculateCRC16CCITT(d) }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("%s panicked: %v", tt.name, r)
				}
			}()
			result := tt.fn(testData)
			if result == nil {
				t.Errorf("%s returned nil", tt.name)
			}
		})
	}
}

// BenchmarkCRC16CCITT benchmarks the CRC-16/CCITT implementation
func BenchmarkCRC16CCITT(b *testing.B) {
	// Create test data similar to MKF patient section (510 bytes)
	data := make([]byte, 510)
	for i := range data {
		data[i] = byte(i % 256)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		calculateCRC16CCITT(data)
	}
}
