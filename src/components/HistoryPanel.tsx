import { Trash2, X, RotateCcw } from 'lucide-react';
import { predictTimeForZone } from '../lib/predictor';
import { getZoneInfo, TIMING_MODES, ZONE_SHORT, ZONE_THROUGH } from '../lib/zones';
import type { CalibrationModel, ThrowRecord } from '../types';

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  model: CalibrationModel;
  throws: ThrowRecord[];
  onDeleteThrow: (id: string) => void;
  onClearAll: () => void;
}

const REFERENCE_ZONES = [1, 4, 7, 10] as const;

export function HistoryPanel({
  open,
  onClose,
  model,
  throws,
  onDeleteThrow,
  onClearAll,
}: HistoryPanelProps) {
  if (!open) return null;

  const modeCfg = TIMING_MODES[model.mode];
  const sortedThrows = [...throws].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Ice calibration and throw history">
      <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2>Ice Calibration &amp; Log</h2>
            <p className="drawer-subtitle">{modeCfg.label} • {modeCfg.description}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Calibration Summary */}
        <div className="cal-card">
          <div className="cal-card-top">
            <span className={`cal-badge status-${model.status}`}>
              {model.status === 'default'
                ? 'Default Ice'
                : model.status === 'calibrating'
                  ? `Calibrating (${model.sampleCount})`
                  : `Calibrated (${model.sampleCount})`}
            </span>
            {model.maeZones !== null && (
              <span className="cal-mae">Avg error ±{model.maeZones.toFixed(1)} zones</span>
            )}
          </div>

          <div className="cal-stats">
            <div className="cal-stat">
              <span className="cal-stat-label">Button (Zone 7)</span>
              <span className="cal-stat-value">{model.t7Seconds.toFixed(2)}s</span>
            </div>
            <div className="cal-stat">
              <span className="cal-stat-label">Sec / Zone</span>
              <span className="cal-stat-value">{Math.abs(model.secPerZone).toFixed(3)}s</span>
            </div>
          </div>

          <div className="ref-table">
            {REFERENCE_ZONES.map((z) => {
              const info = getZoneInfo(z);
              const t = predictTimeForZone(z, model);
              return (
                <div key={z} className="ref-cell">
                  <span className="ref-zone">Z{z} {info.shortLabel}</span>
                  <span className="ref-time">{t.toFixed(2)}s</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Logged Throws */}
        <div className="history-header">
          <h3>Submitted Throws ({sortedThrows.length})</h3>
          {sortedThrows.length > 0 && (
            <button
              type="button"
              className="clear-btn"
              onClick={() => {
                if (window.confirm(`Clear all ${sortedThrows.length} ${modeCfg.label} throws?`)) {
                  onClearAll();
                }
              }}
            >
              <RotateCcw size={14} />
              Clear Session
            </button>
          )}
        </div>

        {sortedThrows.length === 0 ? (
          <div className="empty-history">
            No throws logged yet for {modeCfg.label}.<br />
            Predictions are using sane defaults until you submit your first throw.
          </div>
        ) : (
          <ul className="history-list">
            {sortedThrows.map((rec, idx) => {
              const info = getZoneInfo(rec.actualZone);
              const isBoundary =
                rec.actualZone <= ZONE_SHORT || rec.actualZone >= ZONE_THROUGH;
              const predDisplay =
                rec.predictedZone > 10.5
                  ? '10+'
                  : rec.predictedZone < 0.5
                    ? '<1'
                    : rec.predictedZone.toFixed(1);
              const delta = rec.actualZone - rec.predictedZone;
              const sign = delta >= 0 ? '+' : '';
              return (
                <li key={rec.id} className="history-item">
                  <div className="history-index">#{sortedThrows.length - idx}</div>
                  <div className="history-time">{rec.timeSeconds.toFixed(2)}s</div>
                  <div className="history-zone">
                    <span className="history-zone-main">
                      {isBoundary ? info.display : `Zone ${info.display}`}
                    </span>
                    <span className="history-zone-sub">{info.shortLabel}</span>
                  </div>
                  <div className="history-pred">
                    <span>Pred {predDisplay}</span>
                    {!isBoundary && (
                      <span className="history-delta">({sign}{delta.toFixed(1)})</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="delete-throw-btn"
                    onClick={() => onDeleteThrow(rec.id)}
                    aria-label={`Delete throw ${rec.timeSeconds.toFixed(2)} seconds`}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
