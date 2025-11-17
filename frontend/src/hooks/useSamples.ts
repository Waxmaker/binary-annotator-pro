import { useState, useCallback } from "react";

export interface SampleStats {
  min: number;
  max: number;
  mean: number;
  rms: number;
  count: number;
}

export function useSamples() {
  const [samples, setSamples] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const parseSamples = useCallback((input: string): boolean => {
    setError(null);

    if (!input.trim()) {
      setSamples([]);
      return true;
    }

    // Split by whitespace (spaces, newlines, tabs)
    const tokens = input.trim().split(/\s+/);
    const parsed: number[] = [];

    for (const token of tokens) {
      const num = parseInt(token, 10);
      if (isNaN(num)) {
        setError(`Invalid sample format. Found "${token}" - use space-separated integers.`);
        return false;
      }
      parsed.push(num);
    }

    if (parsed.length === 0) {
      setError("No valid samples found.");
      return false;
    }

    setSamples(parsed);
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
    error,
    parseSamples,
    getStats,
  };
}
