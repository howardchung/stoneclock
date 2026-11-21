import type { CalibrationModel, PredictionResult, ThrowRecord, TimingMode } from '../types';
import { getZoneInfo, TIMING_MODES, ZONE_SHORT, ZONE_THROUGH } from './zones';

/** Prior regularization weights (centered at Zone 7 = Button / Tee-line) */
const PRIOR_WEIGHT_INTERCEPT = 0.35;
const PRIOR_WEIGHT_SLOPE = 18.0;
/** Exponential recency decay per older throw so model tracks changing ice speed */
const RECENCY_DECAY = 0.92;
/** Weight multiplier for censored boundary outcomes (0 = Short, 11 = 10+ Through) */
const CENSORED_WEIGHT = 0.5;

function solveRegularizedRegression(
  samples: readonly { x: number; t: number; w: number }[],
  mode: TimingMode,
): { t7: number; secPerZone: number } {
  const cfg = TIMING_MODES[mode];
  let sW = 0;
  let sWx = 0;
  let sWxx = 0;
  let sWt = 0;
  let sWxt = 0;

  for (const { x, t, w } of samples) {
    sW += w;
    sWx += w * x;
    sWxx += w * x * x;
    sWt += w * t;
    sWxt += w * x * t;
  }

  const a11 = sW + PRIOR_WEIGHT_INTERCEPT;
  const a12 = sWx;
  const a22 = sWxx + PRIOR_WEIGHT_SLOPE;
  const r1 = sWt + PRIOR_WEIGHT_INTERCEPT * cfg.defaultT7;
  const r2 = sWxt + PRIOR_WEIGHT_SLOPE * cfg.defaultSecPerZone;

  const det = a11 * a22 - a12 * a12;
  let t7 = cfg.defaultT7;
  let secPerZone = cfg.defaultSecPerZone;

  if (Math.abs(det) > 1e-9) {
    t7 = (r1 * a22 - r2 * a12) / det;
    secPerZone = (a11 * r2 - a12 * r1) / det;
  }

  // Clamp slope to physically plausible negative range
  secPerZone = Math.max(cfg.minSecPerZone, Math.min(cfg.maxSecPerZone, secPerZone));

  // Re-solve optimal intercept for the clamped slope
  t7 = (sWt - secPerZone * sWx + PRIOR_WEIGHT_INTERCEPT * cfg.defaultT7) / a11;

  return { t7, secPerZone };
}

/**
 * Fits a Bayesian / ridge-regularized weighted linear model:
 *   time(zone) = t7 + secPerZone * (zone - 7)
 *
 * - Exact outcomes (1..10) receive full recency-weighted contribution.
 * - Censored outcomes (0 = Short, 11 = 10+ Through) only nudge the model when the
 *   current fit disagrees with them (e.g., a fast takeout logged as 10+ won't distort
 *   draw-weight calibration, whereas a draw-speed stone that unexpectedly goes through
 *   or comes up short gently shifts the ice speed).
 */
export function fitCalibrationModel(
  throws: readonly ThrowRecord[],
  mode: TimingMode,
): CalibrationModel {
  const cfg = TIMING_MODES[mode];
  const modeThrows = throws
    .filter((t) => t.mode === mode)
    .sort((a, b) => a.timestamp - b.timestamp);

  const n = modeThrows.length;
  if (n === 0) {
    return {
      mode,
      t7Seconds: cfg.defaultT7,
      secPerZone: cfg.defaultSecPerZone,
      sampleCount: 0,
      maeZones: null,
      status: 'default',
    };
  }

  // Pass 1: fit on exact 1..10 throws (or fall back to defaults if only censored throws exist)
  const exactSamples: { x: number; t: number; w: number }[] = [];
  const censoredThrows: { rec: ThrowRecord; w: number }[] = [];

  for (let i = 0; i < n; i++) {
    const rec = modeThrows[i];
    const age = n - 1 - i;
    const w = Math.pow(RECENCY_DECAY, age);
    if (rec.actualZone <= ZONE_SHORT || rec.actualZone >= ZONE_THROUGH) {
      censoredThrows.push({ rec, w });
    } else {
      exactSamples.push({ x: rec.actualZone - 7, t: rec.timeSeconds, w });
    }
  }

  let { t7, secPerZone } = solveRegularizedRegression(exactSamples, mode);

  // Pass 2: include informative censored throws (where current model disagrees with Short / Through)
  if (censoredThrows.length > 0) {
    const combined = [...exactSamples];
    let addedCensored = false;

    for (const { rec, w } of censoredThrows) {
      const pred = 7 + (rec.timeSeconds - t7) / secPerZone;
      if (rec.actualZone <= ZONE_SHORT && pred > 0.5) {
        combined.push({ x: 0 - 7, t: rec.timeSeconds, w: w * CENSORED_WEIGHT });
        addedCensored = true;
      } else if (rec.actualZone >= ZONE_THROUGH && pred < 10.5) {
        combined.push({ x: 11 - 7, t: rec.timeSeconds, w: w * CENSORED_WEIGHT });
        addedCensored = true;
      }
    }

    if (addedCensored) {
      ({ t7, secPerZone } = solveRegularizedRegression(combined, mode));
    }
  }

  // Compute in-sample MAE in zones (censored-aware)
  let maeZones: number | null = null;
  if (n >= 2) {
    let totalErr = 0;
    for (const rec of modeThrows) {
      const pred = 7 + (rec.timeSeconds - t7) / secPerZone;
      if (rec.actualZone <= ZONE_SHORT) {
        totalErr += Math.max(0, pred - 0.5);
      } else if (rec.actualZone >= ZONE_THROUGH) {
        totalErr += Math.max(0, 10.5 - pred);
      } else {
        totalErr += Math.abs(pred - rec.actualZone);
      }
    }
    maeZones = totalErr / n;
  }

  const status: CalibrationModel['status'] =
    n >= 4 ? 'calibrated' : 'calibrating';

  return {
    mode,
    t7Seconds: t7,
    secPerZone,
    sampleCount: n,
    maeZones,
    status,
  };
}

/**
 * Predicts where a stone will stop (1-10 system) given its split time and calibration model.
 */
export function predictZone(
  timeSeconds: number,
  model: CalibrationModel,
): PredictionResult {
  const continuousZone = 7 + (timeSeconds - model.t7Seconds) / model.secPerZone;

  if (continuousZone > 10.5) {
    return {
      continuousZone,
      nearestZone: 10,
      rangeStatus: 'through',
      label: 'Through (Heavy)',
    };
  }

  if (continuousZone < 0.5) {
    return {
      continuousZone,
      nearestZone: 1,
      rangeStatus: 'short',
      label: 'Short (Hogged)',
    };
  }

  const nearestZone = Math.max(1, Math.min(10, Math.round(continuousZone)));
  const info = getZoneInfo(nearestZone);

  return {
    continuousZone,
    nearestZone,
    rangeStatus: 'in-range',
    label: info.label,
  };
}

/**
 * Inverse prediction: estimated split time (seconds) to reach a target zone.
 */
export function predictTimeForZone(zone: number, model: CalibrationModel): number {
  return model.t7Seconds + model.secPerZone * (zone - 7);
}
