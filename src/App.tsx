import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { History, RotateCcw, Sun, SunDim } from 'lucide-react';
import { HistoryPanel } from './components/HistoryPanel';
import { SheetVisualizer } from './components/SheetVisualizer';
import { ZoneSelector } from './components/ZoneSelector';
import { useThrowHistory } from './hooks/useThrowHistory';
import { useWakeLock } from './hooks/useWakeLock';
import { fitCalibrationModel, predictZone } from './lib/predictor';
import { getZoneInfo, TIMING_MODES, ZONE_SHORT, ZONE_THROUGH } from './lib/zones';
import type { TimingMode } from './types';

type TimerState = 'idle' | 'running' | 'stopped';

export function App() {
  const {
    modeThrows,
    mode,
    setMode,
    addThrow,
    deleteThrow,
    clearModeThrows,
  } = useThrowHistory();

  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const { isSupported: wakeLockSupported, isLocked } = useWakeLock(keepAwake);

  const model = useMemo(
    () => fitCalibrationModel(modeThrows, mode),
    [modeThrows, mode],
  );

  const modeCfg = TIMING_MODES[mode];
  const elapsedSeconds = elapsedMs / 1000;

  // Live prediction: shown once stopped, or while running after minimum plausible threshold
  const livePrediction = useMemo(() => {
    if (timerState === 'idle') return null;
    if (timerState === 'running' && elapsedSeconds < modeCfg.liveDisplayMinSeconds) {
      return null;
    }
    return predictZone(elapsedSeconds, model);
  }, [timerState, elapsedSeconds, modeCfg.liveDisplayMinSeconds, model]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const startTimer = useCallback(() => {
    stopLoop();
    const now = performance.now();
    startTimeRef.current = now;
    setElapsedMs(0);
    setSelectedZone(null);
    setTimerState('running');

    const tick = () => {
      setElapsedMs(performance.now() - startTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  const stopTimer = useCallback(() => {
    stopLoop();
    const finalMs = performance.now() - startTimeRef.current;
    setElapsedMs(finalMs);
    setTimerState('stopped');
  }, [stopLoop]);

  const resetTimer = useCallback(() => {
    stopLoop();
    setElapsedMs(0);
    setSelectedZone(null);
    setTimerState('idle');
  }, [stopLoop]);

  const handlePadPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only respond to primary button / touch
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Ignore taps on nested control buttons (e.g., Reset button)
      if ((e.target as HTMLElement).closest('button')) return;

      if (timerState === 'running') {
        stopTimer();
      } else {
        startTimer();
      }
    },
    [timerState, startTimer, stopTimer],
  );

  const handleModeChange = useCallback(
    (nextMode: TimingMode) => {
      if (nextMode === mode) return;
      resetTimer();
      setMode(nextMode);
    },
    [mode, resetTimer, setMode],
  );

  const handleLogThrow = useCallback(
    (zone: number) => {
      if (timerState !== 'stopped' || elapsedSeconds <= 0) return;
      const pred = predictZone(elapsedSeconds, model);
      const info = getZoneInfo(zone);
      const outcomeLabel =
        zone === ZONE_SHORT || zone === ZONE_THROUGH
          ? `${info.display} (${info.shortLabel})`
          : `Zone ${info.display}`;
      addThrow(Number(elapsedSeconds.toFixed(3)), zone, pred.continuousZone);
      showToast(`Logged ${elapsedSeconds.toFixed(2)}s → ${outcomeLabel}`);
      resetTimer();
    },
    [timerState, elapsedSeconds, model, addThrow, showToast, resetTimer],
  );

  // Clean up animation frame & toast timer on unmount
  useEffect(() => {
    return () => {
      stopLoop();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [stopLoop]);

  // Keyboard shortcuts for desktop / laptop use
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (historyOpen) {
        if (e.key === 'Escape') setHistoryOpen(false);
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (timerState === 'running') {
          stopTimer();
        } else {
          startTimer();
        }
      } else if (e.key === 'Escape') {
        resetTimer();
      } else if (timerState === 'stopped') {
        if (e.key === '0') {
          setSelectedZone(ZONE_SHORT);
        } else if (e.key >= '1' && e.key <= '9') {
          setSelectedZone(Number(e.key));
        } else if (e.key === '-') {
          setSelectedZone(10);
        } else if (e.key === '=' || e.key === '+') {
          setSelectedZone(ZONE_THROUGH);
        } else if (e.key === 'Enter' && selectedZone !== null) {
          handleLogThrow(selectedZone);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyOpen, timerState, selectedZone, startTimer, stopTimer, resetTimer, handleLogThrow]);

  const predictionHeadline = useMemo(() => {
    if (timerState === 'idle') {
      return { value: '—', label: `Ready • T-Line ~${model.t7Seconds.toFixed(2)}s`, tone: 'idle' };
    }
    if (!livePrediction) {
      return { value: '…', label: 'Timing stone…', tone: 'timing' };
    }
    if (livePrediction.rangeStatus === 'through') {
      return { value: '10+', label: livePrediction.label, tone: 'through' };
    }
    if (livePrediction.rangeStatus === 'short') {
      return { value: '<1', label: livePrediction.label, tone: 'short' };
    }
    return {
      value: livePrediction.continuousZone.toFixed(1),
      label: livePrediction.label,
      tone: 'in-range',
    };
  }, [timerState, livePrediction, model.t7Seconds]);

  return (
    <div className="app-shell">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          <span className="brand-name">StoneClock</span>
        </div>

        <div className="mode-toggle" role="tablist" aria-label="Timing split mode">
          {(['back-to-hog', 'hog-to-hog'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`mode-btn ${mode === m ? 'active' : ''}`}
              onClick={() => handleModeChange(m)}
            >
              {TIMING_MODES[m].shortLabel}
            </button>
          ))}
        </div>

        <div className="top-actions">
          {wakeLockSupported && (
            <button
              type="button"
              className={`icon-btn ${isLocked ? 'active-lock' : ''}`}
              onClick={() => setKeepAwake((v) => !v)}
              title={keepAwake ? 'Screen wake lock active' : 'Allow screen to sleep'}
              aria-label="Toggle keep screen awake"
            >
              {keepAwake ? <Sun size={18} /> : <SunDim size={18} />}
            </button>
          )}
          <button
            type="button"
            className="icon-btn history-btn"
            onClick={() => setHistoryOpen(true)}
            aria-label="Open ice calibration and throw history"
          >
            <History size={18} />
            {modeThrows.length > 0 && (
              <span className="badge">{modeThrows.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* Live Prediction Card + Sheet Visualizer */}
      <section className={`prediction-card tone-${predictionHeadline.tone}`} aria-live="polite">
        <div className="prediction-top">
          <div className="prediction-readout">
            <span className="prediction-eyebrow">Live Prediction</span>
            <div className="prediction-main">
              <span className="prediction-value">{predictionHeadline.value}</span>
              <span className="prediction-label">{predictionHeadline.label}</span>
            </div>
          </div>

          <button
            type="button"
            className={`cal-pill status-${model.status}`}
            onClick={() => setHistoryOpen(true)}
          >
            {model.status === 'default'
              ? 'Default Ice'
              : model.status === 'calibrating'
                ? `Calibrating (${model.sampleCount})`
                : `Calibrated (${model.sampleCount})`}
          </button>
        </div>

        <SheetVisualizer
          prediction={livePrediction}
          selectedZone={selectedZone}
          isRunning={timerState === 'running'}
        />
      </section>

      {/* Large Tap-to-Start / Tap-to-Stop Area */}
      <main
        className={`timer-pad state-${timerState}`}
        onPointerDown={handlePadPointerDown}
        role="button"
        tabIndex={0}
        aria-label={
          timerState === 'running'
            ? 'Tap to stop timer'
            : 'Tap to start timer'
        }
      >
        {timerState === 'stopped' && (
          <button
            type="button"
            className="reset-chip"
            onClick={resetTimer}
            aria-label="Reset timer"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        )}

        <div className="timer-digits">
          {elapsedSeconds.toFixed(2)}
          <span className="timer-unit">s</span>
        </div>

        <div className="timer-cta">
          {timerState === 'idle' && 'TAP TO START'}
          {timerState === 'running' && 'TAP TO STOP'}
          {timerState === 'stopped' && 'TAP TO TIME NEXT'}
        </div>

        <div className="timer-subhint">
          {timerState === 'idle' && `${modeCfg.label} • Button ~${model.t7Seconds.toFixed(2)}s`}
          {timerState === 'running' && 'Timing in progress…'}
          {timerState === 'stopped' && 'Or log actual outcome (0–10+) below'}
        </div>
      </main>

      {/* 1-10 Zone Input */}
      <ZoneSelector
        selectedZone={selectedZone}
        predicted={timerState === 'stopped' ? livePrediction : null}
        canLog={timerState === 'stopped'}
        onSelectZone={setSelectedZone}
        onLogThrow={handleLogThrow}
      />

      {/* Toast Feedback */}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {/* Calibration & History Drawer */}
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        model={model}
        throws={modeThrows}
        onDeleteThrow={deleteThrow}
        onClearAll={clearModeThrows}
      />
    </div>
  );
}

export default App;
