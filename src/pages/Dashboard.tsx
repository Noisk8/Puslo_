import type { AudioAnalysisState } from '../audio/types';
import type { Settings } from '../state/settingsStore';
import { HistoryGraph } from '../components/HistoryGraph';
const number = (v: number | null) => (v === null ? '—' : v.toFixed(1));
export function Dashboard({
  state,
  settings,
  onCalibrate,
}: {
  state: AudioAnalysisState;
  settings: Settings;
  onCalibrate: () => void;
}) {
  const value = state.calibrated ? state.dba : state.dbfs;
  const thresholds = state.calibrated ? settings.splThresholds : settings.thresholds;
  const severity = state.running ? thresholds.filter((x) => (value ?? -100) >= x).length : 0;
  const unit = state.calibrated ? 'dBA est.' : 'dBFS';
  const low = state.calibrated ? 40 : -60,
    high = state.calibrated ? 120 : 0;
  const percent = state.running
    ? Math.max(0, Math.min(100, (((value ?? low) - low) / (high - low)) * 100))
    : 0;
  const pulse = state.running && performance.now() - state.beat < 160;
  return (
    <>
      <section className="instrument">
        <div className="section-heading">
          <span>
            <span className={`status-dot ${state.running ? 'lit' : ''}`} />{' '}
            {state.running ? (state.suspended ? 'PAUSADO' : 'SEÑAL EN VIVO') : 'SISTEMA EN ESPERA'}
          </span>
          <span className="hide-small">REALTIME AUDIO ANALYSIS</span>
          <span>
            {state.sampleRate ? `${(state.sampleRate / 1000).toFixed(1)} kHz` : '— kHz'} / MONO
          </span>
        </div>
        <div className="readouts">
          <article className="tempo-panel">
            <div className="panel-label">
              <span>01 — TEMPO</span>
              <span>
                RANGE {settings.minBpm}–{settings.maxBpm}
              </span>
            </div>
            <div className={`main-number ${!state.running ? 'idle' : ''}`}>
              <output aria-label="BPM">
                {state.bpm === null ? '— — —' : state.bpm.toFixed(1)}
              </output>
              <span className="unit">BPM</span>
            </div>
            <div className="tempo-bottom">
              <div className="confidence">
                <div>
                  <span>CONFIANZA</span>
                  <strong>
                    {Math.round(state.bpmConfidence * 100)}
                    <small>%</small>
                  </strong>
                </div>
                <div
                  className="confidence-track"
                  role="meter"
                  aria-label="Confianza de tempo"
                  aria-valuenow={Math.round(state.bpmConfidence * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {Array.from({ length: 20 }, (_, i) => (
                    <i key={i} className={i < state.bpmConfidence * 20 ? 'active' : ''} />
                  ))}
                </div>
                <span className="microcopy">
                  {!state.running
                    ? 'LISTO PARA ESCUCHAR'
                    : state.bpm === null
                      ? 'ANALIZANDO · VENTANA 10 s'
                      : 'ESTIMACIÓN ESTABILIZADA'}
                </span>
              </div>
              <div className="beat-monitor">
                <span
                  className={`beat ${pulse ? 'pulse' : ''}`}
                  aria-label={pulse ? 'Pulso activo' : 'Pulso en espera'}
                >
                  <i />
                </span>
                <span>
                  {!state.running || state.beatMode === 'waiting'
                    ? 'BEAT PULSE'
                    : state.beatMode === 'onset'
                      ? 'TRANSITORIO'
                      : 'PROYECTADO'}
                </span>
              </div>
            </div>
          </article>
          <article className="level-panel">
            <div className="panel-label">
              <span>02 — {state.calibrated ? 'SOUND PRESSURE' : 'NIVEL DIGITAL'}</span>
              <span className={state.calibrated ? 'green' : 'amber'}>
                {state.calibrated ? 'A / CALIBRADO' : 'SPL SIN CALIBRAR'}
              </span>
            </div>
            <div className={`main-number level-number ${!state.running ? 'idle' : ''}`}>
              <output aria-label="Nivel de audio">
                {state.running || state.elapsed > 0 ? number(value) : '— —'}
              </output>
              <span className="unit">{unit}</span>
            </div>
            <div className="level-bottom">
              <div className="meter-label">
                <span>
                  {state.running
                    ? ['NORMAL', 'ELEVADO', 'ALTO', 'MUY ALTO'][severity]
                    : 'SIN SEÑAL'}
                </span>
                <span className={state.clipping ? 'clip on' : 'clip'}>
                  {state.clipping ? '■ INPUT CLIPPING' : '□ CLIP'}
                </span>
              </div>
              <div
                className="level-meter"
                role="meter"
                aria-label={`Nivel ${unit}`}
                aria-valuemin={low}
                aria-valuemax={high}
                aria-valuenow={Math.max(low, Math.min(high, value ?? low))}
              >
                {Array.from({ length: 48 }, (_, i) => (
                  <i
                    key={i}
                    className={`${i < (percent / 100) * 48 ? 'active' : ''} ${i > 42 ? 'red' : i > 32 ? 'yellow' : ''}`}
                  />
                ))}
              </div>
              <div className="meter-ticks">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i}>{Math.round(low + ((high - low) * i) / 6)}</span>
                ))}
              </div>
              <div className="level-note">
                <span>{settings.response} RESPONSE</span>
                {!state.calibrated ? (
                  <button onClick={onCalibrate}>CALIBRAR dBA ↗</button>
                ) : (
                  <span>{new Date(settings.calibration!.date).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </article>
        </div>
        <div className="metrics">
          <div>
            <span>
              LAeq · {state.leqSeconds < 60 ? `${Math.floor(state.leqSeconds)} s / PROV.` : '1 MIN'}
            </span>
            <strong>
              {number(state.laeq1m)} <small>{state.calibrated ? 'dBA est.' : 'SIN CALIBRAR'}</small>
            </strong>
          </div>
          <div>
            <span>MAX · SESIÓN</span>
            <strong>
              {number(state.maxLevel)} <small>{unit}</small>
            </strong>
          </div>
          <div>
            <span>PEAK · DIGITAL</span>
            <strong>
              {state.elapsed ? number(state.peak) : '—'} <small>dBFS</small>
            </strong>
          </div>
          <div>
            <span>CLIPPING · EVENTOS</span>
            <strong className={state.clipEvents ? 'amber' : ''}>
              {String(state.clipEvents).padStart(3, '0')}{' '}
              <small>{state.clipEvents ? 'REVISAR GANANCIA' : 'SIN SATURACIÓN'}</small>
            </strong>
          </div>
        </div>
      </section>
      <section className="history-panel">
        <div className="section-heading">
          <span>03 — HISTORIAL DE NIVEL</span>
          <span>15 MIN / {state.calibrated ? 'dBA EST.' : 'dBFS'}</span>
        </div>
        <HistoryGraph history={state.history} calibrated={state.calibrated} />
        <div className="history-footer">
          <span>↳ 1 MUESTRA / SEGUNDO</span>
          <span>SOLO EN MEMORIA · SESIÓN ACTUAL</span>
        </div>
      </section>
    </>
  );
}
