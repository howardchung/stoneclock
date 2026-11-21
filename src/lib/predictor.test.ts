import { describe, expect, it } from 'vitest';
import { fitCalibrationModel, predictTimeForZone, predictZone } from './predictor';
import type { ThrowRecord } from '../types';

function makeThrow(
  timeSeconds: number,
  actualZone: number,
  mode: 'back-to-hog' | 'hog-to-hog' = 'back-to-hog',
  timestamp = Date.now(),
): ThrowRecord {
  return {
    id: `${timestamp}-${Math.random()}`,
    mode,
    timeSeconds,
    actualZone,
    predictedZone: actualZone,
    timestamp,
  };
}

describe('curling stone predictor', () => {
  it('returns sane defaults with zero throws for both modes', () => {
    const bth = fitCalibrationModel([], 'back-to-hog');
    expect(bth.status).toBe('default');
    expect(bth.t7Seconds).toBeCloseTo(3.85, 2);
    expect(bth.secPerZone).toBeLessThan(0);

    const predButton = predictZone(3.85, bth);
    expect(predButton.nearestZone).toBe(7);
    expect(predButton.rangeStatus).toBe('in-range');

    const hth = fitCalibrationModel([], 'hog-to-hog');
    expect(hth.t7Seconds).toBeCloseTo(14.5, 2);
    expect(predictZone(14.5, hth).nearestZone).toBe(7);
  });

  it('predicts heavier (higher zone) for faster times and lighter (lower zone) for slower times', () => {
    const model = fitCalibrationModel([], 'back-to-hog');
    const fast = predictZone(3.67, model);
    const slow = predictZone(4.21, model);
    const through = predictZone(3.2, model);
    const short = predictZone(4.6, model);

    expect(fast.nearestZone).toBe(10);
    expect(slow.nearestZone).toBe(1);
    expect(through.rangeStatus).toBe('through');
    expect(short.rangeStatus).toBe('short');
  });

  it('immediately shifts ice speed from a single throw while keeping valid negative slope', () => {
    // Ice is much faster/keener today: 3.60s lands on Button (Zone 7)
    const model = fitCalibrationModel([makeThrow(3.6, 7, 'back-to-hog', 1)], 'back-to-hog');
    expect(model.status).toBe('calibrating');
    expect(model.t7Seconds).toBeLessThan(3.7);
    expect(model.secPerZone).toBeLessThan(0);
    expect(predictZone(3.65, model).nearestZone).toBe(7);
  });

  it('calibrates accurately across multiple throws spanning guards and back house', () => {
    // Simulated keen hog-to-hog ice: T-line = 13.80s, -0.15s per zone
    const throws = [
      makeThrow(14.7, 1, 'hog-to-hog', 1),
      makeThrow(14.25, 4, 'hog-to-hog', 2),
      makeThrow(13.8, 7, 'hog-to-hog', 3),
      makeThrow(13.35, 10, 'hog-to-hog', 4),
      makeThrow(13.82, 7, 'hog-to-hog', 5),
    ];

    const model = fitCalibrationModel(throws, 'hog-to-hog');
    expect(model.status).toBe('calibrated');
    expect(model.t7Seconds).toBeCloseTo(13.85, 1);
    expect(predictZone(13.8, model).nearestZone).toBe(7);
    expect(predictZone(14.25, model).nearestZone).toBe(4);
    expect(predictZone(13.35, model).nearestZone).toBe(10);
    expect(model.maeZones).not.toBeNull();
    expect(model.maeZones!).toBeLessThan(0.5);
  });

  it('never inverts slope even with noisy inverted outliers', () => {
    const noisy = [
      makeThrow(3.7, 2, 'back-to-hog', 1),
      makeThrow(4.1, 9, 'back-to-hog', 2),
    ];
    const model = fitCalibrationModel(noisy, 'back-to-hog');
    expect(model.secPerZone).toBeLessThan(0);
  });

  it('round-trips predictTimeForZone and predictZone', () => {
    const model = fitCalibrationModel([], 'hog-to-hog');
    for (let z = 1; z <= 10; z++) {
      const t = predictTimeForZone(z, model);
      expect(predictZone(t, model).nearestZone).toBe(z);
    }
  });

  it('handles 0 (Short) and 10+ (Through) throws without letting fast takeouts distort draw weight', () => {
    // A fast 2.60s takeout logged as 10+ (zone 11) is already predicted through, so t7 stays at default
    const afterTakeout = fitCalibrationModel([makeThrow(2.6, 11, 'back-to-hog', 1)], 'back-to-hog');
    expect(afterTakeout.t7Seconds).toBeCloseTo(3.85, 2);

    // A draw-speed 3.80s stone that unexpectedly goes 10+ (Through) shifts t7 faster (higher time = deeper)
    const keenThrough = fitCalibrationModel([makeThrow(3.8, 11, 'back-to-hog', 1)], 'back-to-hog');
    expect(keenThrough.t7Seconds).toBeGreaterThan(3.85);

    // A 4.00s stone that unexpectedly hogs (0 = Short) shifts t7 slower (lower time needed for button)
    const heavyShort = fitCalibrationModel([makeThrow(4.0, 0, 'back-to-hog', 1)], 'back-to-hog');
    expect(heavyShort.t7Seconds).toBeLessThan(3.85);
  });
});
