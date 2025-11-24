import { useState, useCallback } from "react";

export interface SampleStats {
  min: number;
  max: number;
  mean: number;
  rms: number;
  count: number;
}

export interface TimestampedSample {
  timestamp: number;
  value: number;
}

export function useSamples() {
  const [samples, setSamples] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const parseSamples = useCallback((input: string): boolean => {
    setError(null);

    if (!input.trim()) {
      setSamples([]);
      setTimestamps([]);
      return true;
    }

    // Try to detect CSV format (timestamp,value)
    const lines = input.trim().split(/\r?\n/);

    // Check if first line looks like CSV header
    const isCSV = lines[0]?.includes(',');

    if (isCSV) {
      return parseCSV(lines);
    } else {
      return parseSpaceSeparated(input);
    }
  }, []);

  const parseCSV = useCallback((lines: string[]): boolean => {
    const parsed: number[] = [];
    const parsedTimestamps: number[] = [];

    // Skip header if present (contains "timestamp" or "value")
    let startIdx = 0;
    if (lines[0].toLowerCase().includes('timestamp') ||
        lines[0].toLowerCase().includes('value')) {
      startIdx = 1;
    }

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const parts = line.split(',');
      if (parts.length !== 2) {
        setError(`Invalid CSV format on line ${i + 1}. Expected "timestamp,value".`);
        return false;
      }

      const timestamp = parseFloat(parts[0].trim());
      const value = parseFloat(parts[1].trim());

      if (isNaN(timestamp)) {
        setError(`Invalid timestamp on line ${i + 1}: "${parts[0]}"`);
        return false;
      }

      if (isNaN(value)) {
        setError(`Invalid value on line ${i + 1}: "${parts[1]}"`);
        return false;
      }

      parsedTimestamps.push(timestamp);
      parsed.push(value);
    }

    if (parsed.length === 0) {
      setError("No valid samples found in CSV.");
      return false;
    }

    setTimestamps(parsedTimestamps);
    setSamples(parsed);
    return true;
  }, []);

  const parseSpaceSeparated = useCallback((input: string): boolean => {
    // Split by whitespace (spaces, newlines, tabs)
    const tokens = input.trim().split(/\s+/);
    const parsed: number[] = [];

    for (const token of tokens) {
      const num = parseInt(token, 10);
      if (isNaN(num)) {
        setError(`Invalid sample format. Found "${token}" - use space-separated integers or CSV format.`);
        return false;
      }
      parsed.push(num);
    }

    if (parsed.length === 0) {
      setError("No valid samples found.");
      return false;
    }

    setSamples(parsed);
    setTimestamps([]);
    return true;
  }, []);

  const getStats = useCallback((): SampleStats | null => {
    if (samples.length === 0) return null;

    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const sum = samples.reduce((acc, val) => acc + val, 0);
    const mean = sum / samples.length;
    const sumSquares = samples.reduce((acc, val) => acc + val * val, 0);
    const rms = Math.sqrt(sumSquares / samples.length);

    return {
      min,
      max,
      mean,
      rms,
      count: samples.length,
    };
  }, [samples]);

  return {
    samples,
    timestamps,
    error,
    parseSamples,
    getStats,
  };
}
