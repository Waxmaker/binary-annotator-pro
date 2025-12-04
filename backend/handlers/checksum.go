package handlers

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"hash/adler32"
	"hash/crc32"
	"net/http"

	"binary-annotator-pro/models"

	"github.com/labstack/echo/v4"
)

type ChecksumRequest struct {
	FileID uint `json:"fileId"`
	Offset int  `json:"offset"`
	Length int  `json:"length"`
}

type ChecksumResponse struct {
	// Simple checksums (very common in proprietary binary formats)
	Sum8         string `json:"sum8"`
	Sum16LE      string `json:"sum16_le"`
	Sum16BE      string `json:"sum16_be"`
	Sum32        string `json:"sum32"`
	XOR8         string `json:"xor8"`
	NegativeSum8 string `json:"negative_sum8"`

	// Standard checksums
	Fletcher16  string `json:"fletcher16"`
	Adler32     string `json:"adler32"`
	BSDChecksum string `json:"bsd_checksum"`

	// CRC (most common)
	CRC8        string `json:"crc8"`
	CRC16Modbus string `json:"crc16_modbus"`
	CRC16XModem string `json:"crc16_xmodem"`
	CRC16CCITT  string `json:"crc16_ccitt"` // Used in Schiller MKF files
	CRC32       string `json:"crc32"`

	// Cryptographic hashes
	MD5    string `json:"md5"`
	SHA1   string `json:"sha1"`
	SHA256 string `json:"sha256"`
	SHA512 string `json:"sha512"`

	// Metadata
	Offset int `json:"offset"`
	Length int `json:"length"`
}

func (h *Handler) CalculateChecksum(c echo.Context) error {
	var req ChecksumRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Validate request
	if req.FileID == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "fileId is required"})
	}
	if req.Length <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "length must be greater than 0"})
	}
	if req.Offset < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "offset must be non-negative"})
	}

	// Get file from database
	var file models.File
	if err := h.db.GormDB.First(&file, req.FileID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File not found"})
	}

	// Validate offset and length against file size
	if req.Offset >= len(file.Data) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "offset exceeds file size"})
	}

	endOffset := req.Offset + req.Length
	if endOffset > len(file.Data) {
		endOffset = len(file.Data)
		req.Length = endOffset - req.Offset
	}

	// Extract the byte range
	data := file.Data[req.Offset:endOffset]

	// Calculate all checksums
	response := ChecksumResponse{
		Offset: req.Offset,
		Length: req.Length,
	}

	// ===== Simple Checksums (very common in proprietary formats) =====

	// Sum8: Simple 8-bit addition modulo 256
	var sum8 uint8
	for _, b := range data {
		sum8 += b
	}
	response.Sum8 = fmt.Sprintf("%02x", sum8)

	// Sum16 Little Endian: 16-bit addition in little endian order
	var sum16LE uint16
	for i := 0; i < len(data); i += 2 {
		if i+1 < len(data) {
			sum16LE += uint16(data[i]) | (uint16(data[i+1]) << 8)
		} else {
			sum16LE += uint16(data[i])
		}
	}
	response.Sum16LE = fmt.Sprintf("%04x", sum16LE)

	// Sum16 Big Endian: 16-bit addition in big endian order
	var sum16BE uint16
	for i := 0; i < len(data); i += 2 {
		if i+1 < len(data) {
			sum16BE += (uint16(data[i]) << 8) | uint16(data[i+1])
		} else {
			sum16BE += uint16(data[i]) << 8
		}
	}
	response.Sum16BE = fmt.Sprintf("%04x", sum16BE)

	// Sum32: 32-bit addition
	var sum32 uint32
	for _, b := range data {
		sum32 += uint32(b)
	}
	response.Sum32 = fmt.Sprintf("%08x", sum32)

	// XOR8: XOR of all bytes
	var xor8 uint8
	for _, b := range data {
		xor8 ^= b
	}
	response.XOR8 = fmt.Sprintf("%02x", xor8)

	// Negative Sum8: Two's complement of sum8
	negSum8 := uint8(-int8(sum8))
	response.NegativeSum8 = fmt.Sprintf("%02x", negSum8)

	// ===== Standard Checksums =====

	// Fletcher-16: Double checksum algorithm
	var sum1, sum2 uint16
	for _, b := range data {
		sum1 = (sum1 + uint16(b)) % 255
		sum2 = (sum2 + sum1) % 255
	}
	fletcher16 := (sum2 << 8) | sum1
	response.Fletcher16 = fmt.Sprintf("%04x", fletcher16)

	// Adler-32: More robust variant of Fletcher
	adler32Hash := adler32.Checksum(data)
	response.Adler32 = fmt.Sprintf("%08x", adler32Hash)

	// BSD Checksum: Rotating checksum
	var bsdSum uint16
	for _, b := range data {
		bsdSum = ((bsdSum >> 1) | ((bsdSum & 1) << 15))
		bsdSum += uint16(b)
	}
	response.BSDChecksum = fmt.Sprintf("%04x", bsdSum)

	// ===== CRC Checksums =====

	// CRC-8 (polynomial 0x07)
	crc8 := calculateCRC8(data)
	response.CRC8 = fmt.Sprintf("%02x", crc8)

	// CRC-16/MODBUS (most common in industrial systems)
	crc16Modbus := calculateCRC16Modbus(data)
	response.CRC16Modbus = fmt.Sprintf("%04x", crc16Modbus)

	// CRC-16/XMODEM (common in serial communication)
	crc16XModem := calculateCRC16XModem(data)
	response.CRC16XModem = fmt.Sprintf("%04x", crc16XModem)

	// CRC-16/CCITT (polynomial 0x1021, init 0xFFFF, used in Schiller MKF files)
	crc16CCITT := calculateCRC16CCITT(data)
	response.CRC16CCITT = fmt.Sprintf("%04x", crc16CCITT)

	// CRC-32 (IEEE 802.3, used in ZIP, PNG, Ethernet)
	crc32Hash := crc32.ChecksumIEEE(data)
	response.CRC32 = fmt.Sprintf("%08x", crc32Hash)

	// ===== Cryptographic Hashes =====

	// MD5
	md5Hash := md5.Sum(data)
	response.MD5 = hex.EncodeToString(md5Hash[:])

	// SHA-1
	sha1Hash := sha1.Sum(data)
	response.SHA1 = hex.EncodeToString(sha1Hash[:])

	// SHA-256
	sha256Hash := sha256.Sum256(data)
	response.SHA256 = hex.EncodeToString(sha256Hash[:])

	// SHA-512
	sha512Hash := sha512.Sum512(data)
	response.SHA512 = hex.EncodeToString(sha512Hash[:])

	return c.JSON(http.StatusOK, response)
}

// CRC-8 with polynomial 0x07 (used in many embedded systems)
func calculateCRC8(data []byte) uint8 {
	const polynomial uint8 = 0x07
	var crc uint8 = 0x00

	for _, b := range data {
		crc ^= b
		for i := 0; i < 8; i++ {
			if crc&0x80 != 0 {
				crc = (crc << 1) ^ polynomial
			} else {
				crc = crc << 1
			}
		}
	}
	return crc
}

// CRC-16/MODBUS (polynomial 0x8005, initial value 0xFFFF, no final XOR)
func calculateCRC16Modbus(data []byte) uint16 {
	const polynomial uint16 = 0x8005
	crc := uint16(0xFFFF)

	for _, b := range data {
		crc ^= uint16(b)
		for i := 0; i < 8; i++ {
			if crc&0x0001 != 0 {
				crc = (crc >> 1) ^ polynomial
			} else {
				crc = crc >> 1
			}
		}
	}
	return crc
}

// CRC-16/XMODEM (polynomial 0x1021, initial value 0x0000, no final XOR)
func calculateCRC16XModem(data []byte) uint16 {
	const polynomial uint16 = 0x1021
	crc := uint16(0x0000)

	for _, b := range data {
		crc ^= uint16(b) << 8
		for range 8 {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ polynomial
			} else {
				crc = crc << 1
			}
		}
	}
	return crc
}

// CRC-16/CCITT (polynomial 0x1021, initial value 0xFFFF, no final XOR)
// This is the algorithm used by Python's binascii.crc_hqx() and in Schiller MKF files
func calculateCRC16CCITT(data []byte) uint16 {
	const polynomial uint16 = 0x1021
	crc := uint16(0xFFFF)

	for _, b := range data {
		crc ^= uint16(b) << 8
		for range 8 {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ polynomial
			} else {
				crc = crc << 1
			}
		}
	}
	return crc
}
