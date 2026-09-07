import { useState } from 'react';
import type { Settings as SettingsType } from '../state/settingsStore';
export function Settings({
  settings,
  devices,
  onSave,
  onCalibrate,
  onDelete,
}: {
  settings: SettingsType;
  devices: MediaDeviceInfo[];
  onSave: (s: SettingsType) => void;
  onCalibrate: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState('');
  const save = () => {
    if (
      draft.minBpm < 40 ||
      draft.minBpm > 180 ||
      draft.maxBpm < 60 ||
      draft.maxBpm > 250 ||
      draft.minBpm >= draft.maxBpm ||
      !Number.isInteger(draft.minBpm) ||
      !Number.isInteger(draft.maxBpm)
    ) {
      setMessage('Rango válido: mínimo 40–180, máximo 60–250; mínimo menor que máximo.');
      return;
    }
    for (const [values, low, high] of [
      [draft.thresholds, -100, 0],
      [draft.splThresholds, 30, 140],
    ] as [number[], number, number][]) {
      if (
        values.some(
          (x, i) => !Number.isFinite(x) || x < low || x > high || (i > 0 && x <= values[i - 1]),
        )
      ) {
        setMessage('Los tres umbrales deben ser crecientes y estar dentro de la escala.');
        return;
      }
    }
    onSave(draft);
    setMessage('Configuración aplicada.');
  };
  return (
    <section className="settings-page">
      <div className="section-heading">
        <span>02 / CONFIGURACIÓN</span>
        <span>LOCAL SETTINGS</span>
      </div>
      <div className="settings-grid">
        <fieldset>
          <legend>ENTRADA DE AUDIO</legend>
          <label>
            MICRÓFONO
            <select
              value={draft.deviceId}
              onChange={(e) => setDraft({ ...draft, deviceId: e.target.value })}
            >
              <option value="">Predeterminado del sistema</option>
              {devices
                .filter((d) => d.deviceId && d.deviceId !== 'default')
                .map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Entrada ${i + 1}`}
                  </option>
                ))}
            </select>
          </label>
          <p className="small">
            Los nombres aparecen después de conceder permiso. Cambiar la entrada reinicia la sesión.
          </p>
          <label>
            RESPUESTA DEL DISPLAY
            <select
              value={draft.response}
              onChange={(e) => setDraft({ ...draft, response: e.target.value as 'FAST' | 'SLOW' })}
            >
              <option>SLOW</option>
              <option>FAST</option>
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>DETECCIÓN DE TEMPO</legend>
          <div className="input-pair">
            <label>
              MÍNIMO · BPM
              <input
                type="number"
                min={40}
                max={180}
                value={draft.minBpm}
                onChange={(e) => setDraft({ ...draft, minBpm: Number(e.target.value) })}
              />
            </label>
            <label>
              MÁXIMO · BPM
              <input
                type="number"
                min={60}
                max={250}
                value={draft.maxBpm}
                onChange={(e) => setDraft({ ...draft, maxBpm: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="small">
            Ventana de 10 s · análisis cada 3 s. Cambiar el rango reinicia la sesión.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.keepAwake}
              onChange={(e) => setDraft({ ...draft, keepAwake: e.target.checked })}
            />{' '}
            Mantener pantalla activa
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.fullscreen}
              onChange={(e) => setDraft({ ...draft, fullscreen: e.target.checked })}
            />{' '}
            Fullscreen al iniciar
          </label>
        </fieldset>
        <fieldset>
          <legend>UMBRALES VISUALES</legend>
          <p className="small">Elevado / alto / muy alto. Referencias visuales configurables.</p>
          {(['thresholds', 'splThresholds'] as const).map((key) => (
            <div key={key}>
              <span className="small">
                {key === 'thresholds' ? 'dBFS · −100 a 0' : 'dBA ESTIMADO · 30 a 140'}
              </span>
              <div className="thresholds">
                {draft[key].map((value, i) => (
                  <input
                    key={i}
                    aria-label={`${key === 'thresholds' ? 'dBFS' : 'dBA'} ${['elevado', 'alto', 'muy alto'][i]}`}
                    type="number"
                    value={value}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [key]: draft[key].map((x, j) => (i === j ? Number(e.target.value) : x)),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        <fieldset>
          <legend>CALIBRACIÓN SPL</legend>
          <p className="amber">{settings.calibration ? 'REFERENCIA GUARDADA' : 'SIN CALIBRAR'}</p>
          {settings.calibration && (
            <p className="small">
              {settings.calibration.deviceLabel}
              <br />
              {new Date(settings.calibration.date).toLocaleString()} ·{' '}
              {settings.calibration.sampleRate} Hz
            </p>
          )}
          <button onClick={onCalibrate}>
            {settings.calibration ? 'RECALIBRAR' : 'CALIBRAR dBA'} ↗
          </button>
          {settings.calibration && (
            <button className="delete" onClick={onDelete}>
              ELIMINAR CALIBRACIÓN
            </button>
          )}
        </fieldset>
      </div>
      <div className="settings-save">
        <button className="primary" onClick={save}>
          APLICAR CONFIGURACIÓN ↵
        </button>
        <span role="status">{message}</span>
      </div>
    </section>
  );
}
