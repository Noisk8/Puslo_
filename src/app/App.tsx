import { useEffect, useState } from 'react';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useMicrophone } from '../hooks/useMicrophone';
import { useFullscreen } from '../hooks/useFullscreen';
import { useWakeLock } from '../hooks/useWakeLock';
import { audioEngine } from '../state/audioStore';
import { readSettings, saveSettings, type Settings as SettingsType } from '../state/settingsStore';
import { Dashboard } from '../pages/Dashboard';
import { Settings } from '../pages/Settings';
import { About } from '../pages/About';
import { CalibrationDialog } from '../components/CalibrationDialog';
import '../styles/globals.css';
const errors: Record<string, string> = {
  MICROPHONE_PERMISSION_DENIED:
    'Permiso de micrófono rechazado. Habilítalo en los ajustes del sitio y vuelve a iniciar.',
  NO_AUDIO_INPUT: 'No se encontró la entrada seleccionada. Elige otro micrófono en configuración.',
  AUDIO_CONTEXT_FAILED:
    'No se pudo abrir el audio. Revisa si otra aplicación está usando el dispositivo.',
  WORKLET_LOAD_FAILED: 'No se pudo cargar el procesador de audio. Recarga la aplicación.',
  ESSENTIA_LOAD_FAILED:
    'No se pudo cargar Essentia. El medidor sigue disponible; reinicia la captura para reintentar BPM.',
  ESSENTIA_ANALYSIS_FAILED:
    'El análisis de tempo falló en esta ventana. Se reintentará con la siguiente.',
  INPUT_DISCONNECTED: 'Se desconectó el micrófono. Conecta una entrada y vuelve a iniciar.',
  UNSUPPORTED_BROWSER: 'Necesitas un navegador con Web Audio y AudioWorklet, en HTTPS o localhost.',
};
export default function App() {
  const state = useAudioEngine();
  const devices = useMicrophone(state.running);
  const [settings, setSettings] = useState(readSettings);
  const [tab, setTab] = useState('monitor');
  const [calibration, setCalibration] = useState(false);
  const [notice, setNotice] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [cached, setCached] = useState(false);
  const fullscreen = useFullscreen();
  const wake = useWakeLock(settings.keepAwake && state.running);
  useEffect(() => {
    const off = () => setOffline(!navigator.onLine);
    window.addEventListener('online', off);
    window.addEventListener('offline', off);
    const pagehide = () => {
      void audioEngine.stop();
    };
    window.addEventListener('pagehide', pagehide);
    const ready = (e: MessageEvent) => {
      if (e.data === 'OFFLINE_READY') setCached(true);
    };
    navigator.serviceWorker?.addEventListener('message', ready);
    void navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage('STATUS'));
    return () => {
      window.removeEventListener('online', off);
      window.removeEventListener('offline', off);
      window.removeEventListener('pagehide', pagehide);
      navigator.serviceWorker?.removeEventListener('message', ready);
    };
  }, []);
  const apply = (next: SettingsType) => {
    const restart =
      next.deviceId !== settings.deviceId ||
      next.minBpm !== settings.minBpm ||
      next.maxBpm !== settings.maxBpm;
    setSettings(next);
    audioEngine.configure(next);
    if (!saveSettings(next))
      setNotice('No se pudo guardar la configuración; se usará durante esta sesión.');
    if (restart && (state.running || state.starting)) void audioEngine.start(next.deviceId);
  };
  const start = () => {
    if (state.running || state.starting) {
      void audioEngine.stop();
      return;
    }
    if (settings.fullscreen && !fullscreen.active) void fullscreen.toggle();
    void audioEngine.start(settings.deviceId);
  };
  const elapsed = `${Math.floor(state.elapsed / 3600)
    .toString()
    .padStart(2, '0')}:${Math.floor((state.elapsed % 3600) / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(state.elapsed % 60)
    .toString()
    .padStart(2, '0')}`;
  return (
    <div className="app-shell">
      <header className="masthead">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab('monitor');
          }}
          aria-label="PULSO inicio"
        >
          <span className="brand-symbol">▥</span>
          <span>
            PULSO<span className="brand-dot">_</span>
          </span>
        </a>
        <div className="masthead-description">
          BPM + SOUND METER
          <br />
          <span>PORTABLE AUDIO INSTRUMENT</span>
        </div>
        <div className="version">
          LOCAL PROCESSING
          <br />
          <span>
            SYS. V 0.1.0 <i />
          </span>
        </div>
      </header>
      <nav aria-label="Navegación principal">
        <div className="tabs">
          {[
            ['monitor', '01', 'MONITOR'],
            ['settings', '02', 'CONFIGURACIÓN'],
            ['about', '03', 'INFO'],
          ].map(([id, n, label]) => (
            <button
              key={id}
              className={tab === id ? 'selected' : ''}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <span>{n}</span> {label}
            </button>
          ))}
        </div>
        <button
          className="fullscreen"
          onClick={() => void fullscreen.toggle()}
          aria-label={fullscreen.active ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          ⛶ <span>{fullscreen.active ? 'SALIR' : 'FULLSCREEN'}</span>
        </button>
      </nav>
      <main>
        <div className="session-bar">
          <div>
            <span className="prompt">&gt;_</span>{' '}
            {tab === 'monitor'
              ? 'Escucha. Mide. Encuentra el pulso.'
              : tab === 'settings'
                ? 'Ajusta tu instrumento.'
                : 'Todo sucede en este dispositivo.'}
          </div>
          <span className="session-clock">
            SESSION <strong>{elapsed}</strong>
          </span>
        </div>
        {(state.error || notice || fullscreen.error) && (
          <div role="alert" className="alert">
            !{' '}
            {state.error
              ? (errors[state.error] ??
                'Ocurrió un error al abrir el audio. Detén y vuelve a iniciar.')
              : notice || fullscreen.error}
          </div>
        )}
        {state.suspended && state.running && (
          <div className="alert">
            El navegador pausó el audio.{' '}
            <button onClick={() => void audioEngine.resume()}>REANUDAR</button>
          </div>
        )}
        {state.processing.length > 0 && (
          <div className="alert">
            La entrada mantiene procesamiento activo: {state.processing.join(', ')}. Puede afectar
            la calibración.
          </div>
        )}
        {settings.calibration && state.running && !state.calibrated && (
          <div className="alert">
            La calibración guardada corresponde a otra entrada o frecuencia. Se muestran dBFS.
          </div>
        )}
        {state.clipping && (
          <div role="status" className="alert danger">
            INPUT CLIPPING · La señal está saturada; el SPL estimado puede no ser fiable.
          </div>
        )}
        {tab === 'monitor' ? (
          <Dashboard state={state} settings={settings} onCalibrate={() => setCalibration(true)} />
        ) : tab === 'settings' ? (
          <Settings
            key={JSON.stringify(settings)}
            settings={settings}
            devices={devices}
            onSave={apply}
            onCalibrate={() => setCalibration(true)}
            onDelete={() => apply({ ...settings, calibration: null })}
          />
        ) : (
          <About />
        )}
        <section className="transport">
          <div className="input-info">
            <span className="input-icon">↳</span>
            <div>
              <span>ENTRADA DE AUDIO</span>
              <strong>
                {state.running
                  ? state.deviceLabel || 'Micrófono del dispositivo'
                  : 'MICRÓFONO EN ESPERA'}
              </strong>
              <small>
                {state.starting
                  ? 'Solicitando acceso e iniciando audio…'
                  : state.running
                    ? 'CAPTURA ACTIVA · AUDIO LOCAL'
                    : 'El acceso se solicita solo cuando tú lo inicias.'}
              </small>
            </div>
          </div>
          <button className={`primary start ${state.running ? 'stop' : ''}`} onClick={start}>
            <span>{state.running || state.starting ? '■' : '●'}</span>{' '}
            {state.running || state.starting ? 'DETENER' : 'INICIAR MICRÓFONO'} <span>↵</span>
          </button>
        </section>
        {new URLSearchParams(location.search).get('debug') === '1' && (
          <pre className="debug">
            {JSON.stringify(
              {
                sampleRate: state.sampleRate,
                bufferSize: 4096,
                rawDbfs: state.rawDbfs,
                rawBpm: state.rawBpm,
                stableBpm: state.bpm,
                confidence: state.bpmConfidence,
                candidates: state.candidates,
                worklet: state.running ? 'running' : 'off',
                worker: state.rhythmStatus,
                essentia: state.rhythmStatus,
                droppedSamples: state.dropped,
                droppedFramesEstimated: Math.ceil(state.dropped / 128),
                rms: state.rms,
                processing: state.processing,
              },
              null,
              2,
            )}
          </pre>
        )}
      </main>
      <footer>
        <span>
          <span className="tiny-lock">▣</span> El audio se procesa localmente. No se graba ni se
          envía a servidores.
        </span>
        <span>
          {wake || (offline ? 'SIN CONEXIÓN' : cached ? 'OFFLINE READY' : 'WEB AUDIO / WASM')}
        </span>
      </footer>
      <div className="bottom-mark">
        <span>DESIGNED TO LISTEN.</span>
        <span>NO CLOUD. JUST SOUND.</span>
      </div>
      {calibration && (
        <CalibrationDialog
          running={state.running && !state.suspended}
          onClose={() => setCalibration(false)}
          onSave={(c) => apply({ ...settings, calibration: c })}
        />
      )}
    </div>
  );
}
