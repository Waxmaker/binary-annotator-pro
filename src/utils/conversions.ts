export interface DataConversions {
  uint8: number;
  uint16LE: number;
  uint16BE: number;
  uint32LE: number;
  uint32BE: number;
  int8: number;
  int16LE: number;
  int16BE: number;
  int32LE: number;
  int32BE: number;
  float32LE: number;
  float32BE: number;
  float64LE: number;
  float64BE: number;
  utf8: string;
}

export function convertBytes(bytes: number[]): DataConversions {
  const buffer = new ArrayBuffer(Math.max(8, bytes.length));
  const view = new DataView(buffer);
  
  // Fill buffer with bytes
  bytes.forEach((byte, i) => {
    view.setUint8(i, byte);
  });
  
  const conversions: DataConversions = {
    uint8: bytes.length > 0 ? view.getUint8(0) : 0,
    uint16LE: bytes.length >= 2 ? view.getUint16(0, true) : 0,
    uint16BE: bytes.length >= 2 ? view.getUint16(0, false) : 0,
    uint32LE: bytes.length >= 4 ? view.getUint32(0, true) : 0,
    uint32BE: bytes.length >= 4 ? view.getUint32(0, false) : 0,
    int8: bytes.length > 0 ? view.getInt8(0) : 0,
    int16LE: bytes.length >= 2 ? view.getInt16(0, true) : 0,
    int16BE: bytes.length >= 2 ? view.getInt16(0, false) : 0,
    int32LE: bytes.length >= 4 ? view.getInt32(0, true) : 0,
    int32BE: bytes.length >= 4 ? view.getInt32(0, false) : 0,
    float32LE: bytes.length >= 4 ? view.getFloat32(0, true) : 0,
    float32BE: bytes.length >= 4 ? view.getFloat32(0, false) : 0,
    float64LE: bytes.length >= 8 ? view.getFloat64(0, true) : 0,
    float64BE: bytes.length >= 8 ? view.getFloat64(0, false) : 0,
    utf8: new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes)),
  };
  
  return conversions;
}

export function formatHexBytes(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function formatAscii(bytes: number[]): string {
  return bytes.map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
}
