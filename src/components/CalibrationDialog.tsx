import { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../state/audioStore';
import type { Calibration } from '../audio/dsp/calibration';
export function CalibrationDialog({
  onClose,
  onSave,
  running,
}: {
  onClose: () => void;
  onSave: (c: Calibration) => void;
  running: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reference, setReference] = useState('94.0');
  const [seconds, setSeconds] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    ref.current?.showModal();
    return () => audioEngine.cancelCalibration();
  }, []);
  useEffect(() => {
    if (!capturing) return;
    const timer = setInterval(() => setSeconds((s) => Math.min(6, s + 1)), 1000);
    return () => clearInterval(timer);
  }, [capturing]);
  const begin = () => {
    try {
      audioEngine.beginCalibration();
      setSeconds(0);
      setCapturing(true);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = () => {
    try {
      onSave(audioEngine.finishCalibration(Number(reference)));
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setCapturing(false);
      setSeconds(0);
      audioEngine.cancelCalibration();
    }
  };
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="calibration-title">
      <div className="dialog-top">
        <span>SYS / CALIBRATION</span>
        <button onClick={onClose} aria-label="Cerrar calibración">
          ×
        </button>
      </div>
      <h2 id="calibration-title">Una referencia real.</h2>
      <p>
        Coloca el micrófono junto a un sonómetro de referencia en ponderación A, o usa un calibrador
        de 1 kHz. Mantén el nivel y la ganancia constantes.
      </p>
      <label>
        NIVEL DE REFERENCIA · dBA
        <input
          type="number"
          min="30"
          max="140"
          step="0.1"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </label>
      <div className="calibration-progress">
        <span>{capturing ? `CAPTURANDO · ${seconds} / 6 s` : '01 / ESTABILIZA LA SEÑAL'}</span>
        <progress value={seconds} max={6} />
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!running && <p className="amber">Inicia el micrófono antes de calibrar.</p>}
      <button
        className="primary"
        disabled={!running}
        onClick={capturing && seconds >= 6 ? save : begin}
      >
        {capturing && seconds >= 6
          ? 'GUARDAR CALIBRACIÓN'
          : capturing
            ? 'REINICIAR CAPTURA'
            : 'CAPTURAR REFERENCIA'}
      </button>
      <p className="small">
        Se rechazan señales inestables, silencio y clipping. La calibración se aplica únicamente a
        este dispositivo y frecuencia de muestreo.
      </p>
    </dialog>
  );
}
