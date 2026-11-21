import type { PredictionResult } from '../types';

interface SheetVisualizerProps {
  prediction: PredictionResult | null;
  selectedZone: number | null;
  isRunning: boolean;
}

/**
 * Maps a continuous zone (0.5..10.5) to an X coordinate on the 360px SVG sheet.
 * Hog line at x=28, Zones 1..3 in Free Guard Zone, House centered at Zone 7 (x=252),
 * Back line at x=336.
 */
function zoneToX(zone: number): number {
  const clamped = Math.max(0.2, Math.min(10.8, zone));
  // Zone 1 -> 54, Zone 7 (Button/Tee) -> 246, Zone 10 (Back 12) -> 324
  if (clamped <= 4) {
    // Zones 0.2..4 span x=22..162 (guard zone)
    return 22 + ((clamped - 0.2) / 3.8) * 140;
  }
  // Zones 4..10.8 span x=162..344 (house: 4=Top12, 7=Tee, 10=Back12)
  return 162 + ((clamped - 4) / 6.8) * 182;
}

export function SheetVisualizer({
  prediction,
  selectedZone,
  isRunning,
}: SheetVisualizerProps) {
  const teeX = zoneToX(7);
  const houseRadius = zoneToX(10) - teeX; // 12-foot ring radius (~78px)
  const r8 = houseRadius * 0.67;
  const r4 = houseRadius * 0.34;
  const rBtn = 7;

  const predX = prediction ? zoneToX(prediction.continuousZone) : null;
  const selX =
    selectedZone !== null
      ? zoneToX(selectedZone <= 0 ? 0.2 : selectedZone >= 11 ? 10.8 : selectedZone)
      : null;

  return (
    <div className="sheet-viz" aria-label="Curling sheet stopping zone visualization">
      <svg viewBox="0 0 360 88" className="sheet-svg" role="img">
        {/* Ice sheet background */}
        <rect x="4" y="8" width="352" height="58" rx="10" fill="#0f1d35" stroke="#1e3a5f" strokeWidth="1.5" />

        {/* Center line */}
        <line x1="12" y1="37" x2="348" y2="37" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

        {/* Hog line */}
        <line x1="28" y1="8" x2="28" y2="66" stroke="#ef4444" strokeWidth="2.5" opacity="0.7" />

        {/* House rings (clipped to sheet) */}
        <clipPath id="sheet-clip">
          <rect x="4" y="8" width="352" height="58" rx="10" />
        </clipPath>
        <g clipPath="url(#sheet-clip)">
          {/* 12-foot */}
          <circle cx={teeX} cy="37" r={houseRadius} fill="#1d4ed8" opacity="0.32" stroke="#3b82f6" strokeWidth="1" />
          {/* 8-foot */}
          <circle cx={teeX} cy="37" r={r8} fill="#e2e8f0" opacity="0.16" />
          {/* 4-foot */}
          <circle cx={teeX} cy="37" r={r4} fill="#dc2626" opacity="0.42" />
          {/* Button */}
          <circle cx={teeX} cy="37" r={rBtn} fill="#f8fafc" opacity="0.85" />
          {/* Tee line */}
          <line x1={teeX} y1="8" x2={teeX} y2="66" stroke="#94a3b8" strokeWidth="1" opacity="0.45" />
          {/* Back line */}
          <line x1={teeX + houseRadius} y1="8" x2={teeX + houseRadius} y2="66" stroke="#64748b" strokeWidth="1.2" opacity="0.6" />
        </g>

        {/* Zone ticks 1..10 */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((z) => {
          const x = zoneToX(z);
          const isPred = prediction?.rangeStatus === 'in-range' && prediction.nearestZone === z;
          const isSel = selectedZone === z;
          return (
            <g key={z}>
              <line
                x1={x}
                y1="66"
                x2={x}
                y2="70"
                stroke={isSel ? '#fbbf24' : isPred ? '#38bdf8' : '#475569'}
                strokeWidth={isSel || isPred ? 2 : 1}
              />
              <text
                x={x}
                y="82"
                textAnchor="middle"
                fontSize="9.5"
                fontWeight={isSel || isPred ? '700' : '500'}
                fill={isSel ? '#fbbf24' : isPred ? '#38bdf8' : '#64748b'}
              >
                {z}
              </text>
            </g>
          );
        })}

        {/* Selected actual zone marker */}
        {selX !== null && (
          <g>
            <circle
              cx={selX}
              cy="37"
              r="11"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.2"
              strokeDasharray="3 2"
            />
          </g>
        )}

        {/* Predicted stone position */}
        {predX !== null && prediction && (
          <g className={isRunning ? 'stone-marker running' : 'stone-marker'}>
            {/* Soft glow */}
            <circle
              cx={predX}
              cy="37"
              r="14"
              fill={
                prediction.rangeStatus === 'through'
                  ? '#f97316'
                  : prediction.rangeStatus === 'short'
                    ? '#94a3b8'
                    : '#38bdf8'
              }
              opacity="0.28"
            />
            {/* Stone body */}
            <circle
              cx={predX}
              cy="37"
              r="8.5"
              fill="#e2e8f0"
              stroke={
                prediction.rangeStatus === 'through'
                  ? '#fb923c'
                  : prediction.rangeStatus === 'short'
                    ? '#94a3b8'
                    : '#0284c7'
              }
              strokeWidth="2.5"
            />
            {/* Handle dot */}
            <circle
              cx={predX}
              cy="37"
              r="3.2"
              fill={
                prediction.rangeStatus === 'through'
                  ? '#ea580c'
                  : prediction.rangeStatus === 'short'
                    ? '#475569'
                    : '#ef4444'
              }
            />
          </g>
        )}
      </svg>
    </div>
  );
}
