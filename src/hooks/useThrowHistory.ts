import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThrowRecord, TimingMode } from '../types';

const STORAGE_KEY_THROWS = 'stoneclock:throws:v1';
const STORAGE_KEY_MODE = 'stoneclock:mode:v1';

function loadThrows(): ThrowRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_THROWS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ThrowRecord =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        (item.mode === 'back-to-hog' || item.mode === 'hog-to-hog') &&
        typeof item.timeSeconds === 'number' &&
        typeof item.actualZone === 'number' &&
        typeof item.timestamp === 'number',
    );
  } catch {
    return [];
  }
}

function loadMode(): TimingMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MODE);
    if (raw === 'hog-to-hog' || raw === 'back-to-hog') return raw;
  } catch {
    // ignore storage errors
  }
  return 'back-to-hog';
}

export function useThrowHistory() {
  const [throws, setThrows] = useState<ThrowRecord[]>(loadThrows);
  const [mode, setModeState] = useState<TimingMode>(loadMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THROWS, JSON.stringify(throws));
    } catch {
      // ignore quota/private-mode errors
    }
  }, [throws]);

  const setMode = useCallback((nextMode: TimingMode) => {
    setModeState(nextMode);
    try {
      localStorage.setItem(STORAGE_KEY_MODE, nextMode);
    } catch {
      // ignore storage errors
    }
  }, []);

  const addThrow = useCallback(
    (timeSeconds: number, actualZone: number, predictedZone: number) => {
      const record: ThrowRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode,
        timeSeconds,
        actualZone,
        predictedZone,
        timestamp: Date.now(),
      };
      setThrows((prev) => [...prev, record]);
      return record;
    },
    [mode],
  );

  const deleteThrow = useCallback((id: string) => {
    setThrows((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearModeThrows = useCallback(() => {
    setThrows((prev) => prev.filter((t) => t.mode !== mode));
  }, [mode]);

  const modeThrows = useMemo(
    () => throws.filter((t) => t.mode === mode),
    [throws, mode],
  );

  return {
    throws,
    modeThrows,
    mode,
    setMode,
    addThrow,
    deleteThrow,
    clearModeThrows,
  };
}
