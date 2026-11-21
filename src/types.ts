export type TimingMode = 'back-to-hog' | 'hog-to-hog';

export interface ThrowRecord {
  id: string;
  mode: TimingMode;
  timeSeconds: number;
  actualZone: number; // 0 = Short, 1..10 = Zones 1-10, 11 = 10+ (Through)
  predictedZone: number; // continuous prediction at time of throw
  timestamp: number;
}

export type ZoneGroup = 'short' | 'guard' | 'front-house' | 'button' | 'back-house' | 'through';

export interface ZoneInfo {
  zone: number;
  display: string;
  shortLabel: string;
  label: string;
  group: ZoneGroup;
}

export interface CalibrationModel {
  mode: TimingMode;
  /** Estimated split time (seconds) for a Zone 7 (Button / Tee-line) draw */
  t7Seconds: number;
  /** Change in seconds per +1 zone (always negative: faster time = deeper zone) */
  secPerZone: number;
  /** Number of throws used to calibrate this mode */
  sampleCount: number;
  /** Mean absolute error in zones on submitted throws (null if < 2 throws) */
  maeZones: number | null;
  /** Human-readable calibration status */
  status: 'default' | 'calibrating' | 'calibrated';
}

export type PredictionRangeStatus = 'through' | 'in-range' | 'short';

export interface PredictionResult {
  /** Unclamped continuous zone estimate (e.g. 7.3) */
  continuousZone: number;
  /** Nearest integer zone clamped to 1..10 */
  nearestZone: number;
  /** Whether the stone is predicted short (< 1), in zones 1-10, or through (> 10) */
  rangeStatus: PredictionRangeStatus;
  /** Human-readable description (e.g. "Button / Tee", "Through (Heavy)", "Short (Hogged)") */
  label: string;
}
