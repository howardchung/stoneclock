import { Check } from 'lucide-react';
import { getZoneInfo, OUTCOME_ZONES, ZONE_SHORT, ZONE_THROUGH } from '../lib/zones';
import type { PredictionResult } from '../types';

interface ZoneSelectorProps {
  selectedZone: number | null;
  predicted: PredictionResult | null;
  canLog: boolean;
  onSelectZone: (zone: number) => void;
  onLogThrow: (zone: number) => void;
}

export function ZoneSelector({
  selectedZone,
  predicted,
  canLog,
  onSelectZone,
  onLogThrow,
}: ZoneSelectorProps) {
  const predictedOption = !predicted
    ? null
    : predicted.rangeStatus === 'short'
      ? ZONE_SHORT
      : predicted.rangeStatus === 'through'
        ? ZONE_THROUGH
        : predicted.nearestZone;

  const handleZoneClick = (zone: number) => {
    if (!canLog) return;
    if (selectedZone === zone) {
      // Second tap on already-selected zone logs immediately for fast on-ice use
      onLogThrow(zone);
    } else {
      onSelectZone(zone);
    }
  };

  const selectedInfo = selectedZone !== null ? getZoneInfo(selectedZone) : null;

  return (
    <section className={`zone-panel ${canLog ? 'ready' : 'inactive'}`} aria-label="Where stone ended up (0 to 10+)">
      <div className="zone-panel-header">
        <span className="zone-panel-title">Where did it stop? (0–10+)</span>
        <span className="zone-panel-hint">
          {!canLog
            ? 'Stop timer to log'
            : selectedZone !== null
              ? 'Tap again or press Log'
              : 'Tap zone to calibrate'}
        </span>
      </div>

      <div className="zone-grid" role="group" aria-label="Curling outcomes 0 short through 10+ through">
        {OUTCOME_ZONES.map((z) => {
          const isSelected = selectedZone === z.zone;
          const isPredicted = canLog && predictedOption === z.zone;
          return (
            <button
              key={z.zone}
              type="button"
              disabled={!canLog}
              onClick={() => handleZoneClick(z.zone)}
              className={[
                'zone-btn',
                `group-${z.group}`,
                isSelected ? 'selected' : '',
                isPredicted ? 'predicted' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={isSelected}
            >
              <span className="zone-num">{z.display}</span>
              <span className="zone-sub">{z.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <div className="zone-actions">
        <button
          type="button"
          className="log-btn"
          disabled={!canLog || selectedZone === null}
          onClick={() => selectedZone !== null && onLogThrow(selectedZone)}
        >
          <Check size={18} strokeWidth={2.5} />
          {selectedInfo
            ? selectedInfo.zone === ZONE_SHORT || selectedInfo.zone === ZONE_THROUGH
              ? `Log ${selectedInfo.display} — ${selectedInfo.label}`
              : `Log Zone ${selectedInfo.display} — ${selectedInfo.label}`
            : 'Select outcome (0–10+) to log throw'}
        </button>
      </div>
    </section>
  );
}
