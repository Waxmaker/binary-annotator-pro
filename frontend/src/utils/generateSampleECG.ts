// Generate a sample ECG binary file for demonstration

export function generateSampleECG(): ArrayBuffer {
  // Create a realistic ECG file structure
  const totalSize = 40000; // 40KB file
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  let offset = 0;
  
  // === FILE HEADER (256 bytes at 0x0000) ===
  // Magic bytes (DICM - DICOM-like)
  bytes[offset++] = 0x44; // 'D'
  bytes[offset++] = 0x49; // 'I'
  bytes[offset++] = 0x43; // 'C'
  bytes[offset++] = 0x4D; // 'M'
  
  // Version
  view.setUint16(offset, 0x0201, true); // v2.1 little-endian
  offset += 2;
  
  // Device ID
  bytes[offset++] = 0x4E; // 'N'
  bytes[offset++] = 0x4B; // 'K' (Nihon Kohden)
  
  // Reserved header space
  offset = 0x0100;
  
  // === PATIENT METADATA (512 bytes at 0x0100) ===
  // Patient name (null-terminated string)
  const patientName = "John Doe\0";
  for (let i = 0; i < patientName.length; i++) {
    bytes[offset++] = patientName.charCodeAt(i);
  }
  
  offset = 0x0120;
  // Patient ID
  const patientId = "ECG123456\0";
  for (let i = 0; i < patientId.length; i++) {
    bytes[offset++] = patientId.charCodeAt(i);
  }
  
  // Age, Gender, etc.
  offset = 0x0140;
  bytes[offset++] = 45; // Age
  bytes[offset++] = 0x4D; // 'M' (Male)
  
  // Timestamp (Unix epoch as 32-bit)
  offset = 0x0150;
  view.setUint32(offset, Math.floor(Date.now() / 1000), true);
  offset += 4;
  
  // === LEAD CONFIGURATION (128 bytes at 0x0300) ===
  offset = 0x0300;
  bytes[offset++] = 12; // Number of leads
  
  // Sample rate (500 Hz)
  view.setUint16(offset, 500, true);
  offset += 2;
  
  // Gain settings (2.5 µV/LSB)
  view.setFloat32(offset, 2.5, true);
  offset += 4;
  
  // Bit depth
  bytes[offset++] = 16; // 16-bit samples
  
  // === LEAD I DATA (10000 bytes = 5000 samples at 0x1000) ===
  offset = 0x1000;
  generateECGWaveform(view, offset, 5000, 60); // 60 BPM heartbeat
  
  // === LEAD II DATA (10000 bytes at 0x3710) ===
  offset = 0x3710;
  generateECGWaveform(view, offset, 5000, 60, 1.2); // Slightly different amplitude
  
  // === LEAD III DATA (10000 bytes at 0x5E20) ===
  offset = 0x5E20;
  generateECGWaveform(view, offset, 5000, 60, 0.8);
  
  // === CHECKSUM (4 bytes at 0x8530) ===
  offset = 0x8530;
  const checksum = calculateSimpleChecksum(bytes, 0, offset);
  view.setUint32(offset, checksum, true);
  
  // Add some sync markers throughout
  addSyncMarkers(bytes);
  
  return buffer;
}

/**
 * Generate a realistic ECG waveform (Lead I/II/III)
 */
function generateECGWaveform(
  view: DataView,
  startOffset: number,
  sampleCount: number,
  bpm: number,
  amplitudeScale: number = 1.0
) {
  const sampleRate = 500; // Hz
  const samplesPerBeat = (sampleRate * 60) / bpm;
  
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate; // Time in seconds
    const beatPhase = (i % samplesPerBeat) / samplesPerBeat;
    
    // Generate ECG complex (P-QRS-T)
    let amplitude = 0;
    
    // P wave (atrial depolarization)
    if (beatPhase >= 0.05 && beatPhase < 0.15) {
      const pPhase = (beatPhase - 0.05) / 0.1;
      amplitude += 200 * Math.sin(pPhase * Math.PI);
    }
    
    // QRS complex (ventricular depolarization)
    if (beatPhase >= 0.2 && beatPhase < 0.3) {
      const qrsPhase = (beatPhase - 0.2) / 0.1;
      
      // Q wave (small negative)
      if (qrsPhase < 0.2) {
        amplitude -= 300 * qrsPhase * 5;
      }
      // R wave (large positive spike)
      else if (qrsPhase < 0.5) {
        amplitude += 2000 * Math.sin((qrsPhase - 0.2) / 0.3 * Math.PI);
      }
      // S wave (negative)
      else {
        amplitude -= 400 * Math.sin((qrsPhase - 0.5) / 0.5 * Math.PI);
      }
    }
    
    // T wave (ventricular repolarization)
    if (beatPhase >= 0.4 && beatPhase < 0.6) {
      const tPhase = (beatPhase - 0.4) / 0.2;
      amplitude += 400 * Math.sin(tPhase * Math.PI);
    }
    
    // Add baseline noise
    amplitude += (Math.random() - 0.5) * 50;
    
    // Scale amplitude
    amplitude *= amplitudeScale;
    
    // Clamp to 16-bit signed range
    amplitude = Math.max(-32768, Math.min(32767, Math.round(amplitude)));
    
    // Write as 16-bit signed little-endian
    view.setInt16(startOffset + i * 2, amplitude, true);
  }
}

/**
 * Calculate simple checksum for validation
 */
function calculateSimpleChecksum(bytes: Uint8Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum = (sum + bytes[i]) & 0xFFFFFFFF;
  }
  return sum;
}

/**
 * Add FF FF sync markers at regular intervals
 */
function addSyncMarkers(bytes: Uint8Array) {
  const markerPositions = [0x0800, 0x2000, 0x4000, 0x6000];
  
  for (const pos of markerPositions) {
    if (pos < bytes.length - 2) {
      bytes[pos] = 0xFF;
      bytes[pos + 1] = 0xFF;
    }
  }
}

/**
 * Download the sample ECG file
 */
export function downloadSampleECG() {
  const buffer = generateSampleECG();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample_ecg.dat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
