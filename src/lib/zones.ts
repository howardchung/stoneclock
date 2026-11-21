import type { TimingMode, ZoneInfo } from '../types';

export const ZONE_SHORT = 0;
export const ZONE_THROUGH = 11;

export const ZONES: readonly ZoneInfo[] = [
  { zone: 1, display: '1', shortLabel: 'High Grd', label: 'High Guard', group: 'guard' },
  { zone: 2, display: '2', shortLabel: 'Mid Grd', label: 'Mid Guard', group: 'guard' },
  { zone: 3, display: '3', shortLabel: 'Tight Grd', label: 'Tight Guard', group: 'guard' },
  { zone: 4, display: '4', shortLabel: 'Top 12', label: 'Top 12-Foot', group: 'front-house' },
  { zone: 5, display: '5', shortLabel: 'Top 8', label: 'Top 8-Foot', group: 'front-house' },
  { zone: 6, display: '6', shortLabel: 'Top 4', label: 'Top 4-Foot', group: 'front-house' },
  { zone: 7, display: '7', shortLabel: 'Button', label: 'Button / Tee', group: 'button' },
  { zone: 8, display: '8', shortLabel: 'Back 4', label: 'Back 4-Foot', group: 'back-house' },
  { zone: 9, display: '9', shortLabel: 'Back 8', label: 'Back 8-Foot', group: 'back-house' },
  { zone: 10, display: '10', shortLabel: 'Back 12', label: 'Back 12-Foot', group: 'back-house' },
] as const;

export const OUTCOME_ZONES: readonly ZoneInfo[] = [
  { zone: ZONE_SHORT, display: '0', shortLabel: 'Short', label: 'Short (Hogged)', group: 'short' },
  ...ZONES,
  { zone: ZONE_THROUGH, display: '10+', shortLabel: 'Through', label: 'Through (Heavy)', group: 'through' },
] as const;

export function getZoneInfo(zone: number): ZoneInfo {
  const rounded = Math.round(zone);
  if (rounded <= ZONE_SHORT) return OUTCOME_ZONES[0];
  if (rounded >= ZONE_THROUGH) return OUTCOME_ZONES[OUTCOME_ZONES.length - 1];
  return ZONES[rounded - 1];
}

export interface TimingModeConfig {
  id: TimingMode;
  label: string;
  shortLabel: string;
  description: string;
  defaultT7: number;
  defaultSecPerZone: number;
  minSecPerZone: number; // most negative (steepest)
  maxSecPerZone: number; // least negative (flattest)
  /** Minimum elapsed seconds before showing live prediction instead of "Timing..." */
  liveDisplayMinSeconds: number;
}

export const TIMING_MODES: Record<TimingMode, TimingModeConfig> = {
  'back-to-hog': {
    id: 'back-to-hog',
    label: 'Back → Hog',
    shortLabel: 'Back→Hog',
    description: 'Sweeper split from back line to near hog line (~3.85s T-line)',
    defaultT7: 3.85,
    defaultSecPerZone: -0.06,
    minSecPerZone: -0.15,
    maxSecPerZone: -0.025,
    liveDisplayMinSeconds: 1.5,
  },
  'hog-to-hog': {
    id: 'hog-to-hog',
    label: 'Hog → Hog',
    shortLabel: 'Hog→Hog',
    description: 'Full-ice split between hog lines (~14.50s T-line)',
    defaultT7: 14.5,
    defaultSecPerZone: -0.18,
    minSecPerZone: -0.42,
    maxSecPerZone: -0.07,
    liveDisplayMinSeconds: 6.0,
  },
};
