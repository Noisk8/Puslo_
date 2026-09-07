import workletUrl from './worklets/level-processor.worklet.ts?worker&url';
import { MicrophoneManager, audioError } from './MicrophoneManager';
import type { AudioAnalysisState, LevelBlock } from './types';
import type { Settings } from '../state/settingsStore';
import { readSettings } from '../state/settingsStore';
import { dbfs } from './dsp/levels';
import { EnergySmoother } from './dsp/smoothing';
import { Leq } from './dsp/leq';
import { calibrationOffset, matchesCalibration, type Calibration } from './dsp/calibration';
const initial: AudioAnalysisState = {
  running: false,
  starting: false,
  suspended: false,
  sampleRate: 0,
  deviceId: '',
  deviceLabel: '',
  dbfs: -100,
  rawDbfs: -100,
  rms: 0,
  peak: -100,
  clipping: false,
  clipEvents: 0,
  dba: null,
  calibrated: false,
  laeq1m: null,
  leqSeconds: 0,
  maxLevel: null,
  bpm: null,
  rawBpm: null,
  bpmConfidence: 0,
  candidates: [],
  beat: 0,
  beatMode: 'waiting',
  elapsed: 0,
  history: [],
  error: null,
  rhythmStatus: 'off',
  dropped: 0,
  processing: [],
};
export class AudioEngine {
  private state = { ...initial };
  private listeners = new Set<() => void>();
  private context?: AudioContext;
  private stream?: MediaStream;
  private source?: MediaStreamAudioSourceNode;
  private node?: AudioWorkletNode;
  private worker?: Worker;
  private generation = 0;
  private settings: Settings = readSettings();
  private smoother = new EnergySmoother();
  private aSmoother = new EnergySmoother();
  private leq = new Leq();
  private calibrationLevels: number[] = [];
  private calibrationClips = false;
  private calibrating = false;
  private historySeconds = 0;
  private historyEnergy = 0;
  private historyAEnergy = 0;
  private lastClip = false;
  private lastTempoAt = 0;
  private quietSeconds = 0;
  private nextBeat = Infinity;
  private lastBeat = -1;
  private clipUntil = 0;
  private maxDigital = -100;
  private maxA = -100;
  readonly microphone = new MicrophoneManager();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getState = () => this.state;
  private update(patch: Partial<AudioAnalysisState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  configure(settings: Settings) {
    const calibrationChanged =
      JSON.stringify(this.settings.calibration) !== JSON.stringify(settings.calibration);
    this.settings = settings;
    if (calibrationChanged) {
      this.leq = new Leq();
      this.maxA = -100;
      this.historyAEnergy = 0;
      this.historyEnergy = 0;
      this.historySeconds = 0;
      this.update({ dba: null, laeq1m: null, leqSeconds: 0, maxLevel: null, history: [] });
    }
    this.update({
      calibrated: matchesCalibration(
        settings.calibration,
        this.state.deviceId,
        this.state.sampleRate,
        this.state.deviceLabel,
      ),
    });
  }
  async initialize() {
    if (
      !globalThis.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !globalThis.AudioWorkletNode
    )
      throw new Error('UNSUPPORTED_BROWSER');
  }
  async requestPermission() {
    const stream = await this.microphone.request(this.settings.deviceId);
    stream.getTracks().forEach((t) => t.stop());
  }
  async setInputDevice(deviceId: string) {
    this.settings = { ...this.settings, deviceId };
    if (this.state.running || this.state.starting) await this.start(deviceId);
  }
  async start(deviceId = this.settings.deviceId) {
    const generation = ++this.generation;
    const closing = this.release();
    this.update({ ...initial, history: [], starting: true });
    await closing;
    if (generation !== this.generation) return;
    this.smoother = new EnergySmoother();
    this.aSmoother = new EnergySmoother();
    this.leq = new Leq();
    this.historySeconds = this.historyEnergy = this.historyAEnergy = 0;
    this.lastClip = false;
    this.clipUntil = 0;
    this.lastTempoAt = 0;
    this.quietSeconds = 0;
    this.nextBeat = Infinity;
    this.lastBeat = -1;
    this.maxDigital = this.maxA = -100;
    try {
      await this.initialize();
      if (generation !== this.generation) return;
      const stream = await this.microphone.request(deviceId);
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const track = stream.getAudioTracks()[0];
      track.onended = () => {
        void this.stop();
        this.update({ error: 'INPUT_DISCONNECTED' });
      };
      const context = new AudioContext();
      this.context = context;
      // Safari may keep resume pending until another gesture. Expose a resume
      // button instead of leaving initialization blocked on that promise.
      void context.resume().catch(() => {
        if (generation === this.generation) this.update({ error: 'AUDIO_CONTEXT_FAILED' });
      });
      if (generation !== this.generation) return;
      context.onstatechange = () => {
        if (this.context === context) this.update({ suspended: context.state !== 'running' });
      };
      try {
        await context.audioWorklet.addModule(workletUrl);
      } catch {
        throw new Error('WORKLET_LOAD_FAILED');
      }
      if (generation !== this.generation) return;
      this.source = context.createMediaStreamSource(stream);
      this.node = new AudioWorkletNode(context, 'level-processor');
      this.node.onprocessorerror = () => {
        void this.stop();
        this.update({ error: 'WORKLET_LOAD_FAILED' });
      };
      this.node.port.onmessage = ({ data }: MessageEvent<LevelBlock>) => this.receive(data);
      this.source.connect(this.node);
      this.node.connect(context.destination); // Worklet outputs silence: no monitoring/feedback.
      const trackSettings = track.getSettings();
      this.update({
        running: true,
        starting: false,
        suspended: context.state !== 'running',
        sampleRate: context.sampleRate,
        deviceId: trackSettings.deviceId ?? deviceId,
        deviceLabel: track.label,
        rhythmStatus: 'loading',
        processing: ['autoGainControl', 'echoCancellation', 'noiseSuppression'].filter(
          (key) => trackSettings[key as keyof MediaTrackSettings] === true,
        ),
      });
      this.configure(this.settings);
      const worker = new Worker(new URL('../workers/rhythm.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker = worker;
      const channel = new MessageChannel();
      worker.onmessage = ({ data }) => {
        if (generation !== this.generation) return;
        if (data.type === 'ready') this.update({ rhythmStatus: 'ready' });
        else if (data.type === 'error') this.update({ rhythmStatus: 'error', error: data.error });
        else if (data.type === 'tempo') {
          this.lastTempoAt = this.state.elapsed;
          this.update({
            bpm: data.stable,
            rawBpm: data.raw,
            bpmConfidence: data.confidence,
            candidates: data.candidates ?? [],
            rhythmStatus: 'ready',
            error: this.state.error === 'ESSENTIA_ANALYSIS_FAILED' ? null : this.state.error,
          });
          const last = data.ticks?.at(-1);
          const bpm = data.stable;
          if (last !== undefined && bpm && data.confidence > 0.25) {
            const period = 60 / bpm;
            this.nextBeat =
              last + Math.max(1, Math.ceil((context.currentTime - last) / period)) * period;
          } else this.nextBeat = Infinity;
        }
      };
      worker.onerror = () => this.update({ rhythmStatus: 'error', error: 'ESSENTIA_LOAD_FAILED' });
      worker.postMessage(
        {
          type: 'init',
          rate: context.sampleRate,
          min: this.settings.minBpm,
          max: this.settings.maxBpm,
          base: new URL(import.meta.env.BASE_URL, location.href).href,
          port: channel.port1,
        },
        [channel.port1],
      );
      this.node.port.postMessage({ type: 'rhythm', port: channel.port2 }, [channel.port2]);
    } catch (error) {
      if (generation === this.generation) {
        const stopping = this.stop();
        this.update({ error: audioError(error) });
        await stopping;
      }
    }
  }
  private receive(data: LevelBlock) {
    if (!this.state.running) return;
    const elapsed = this.state.elapsed + data.seconds;
    const tau = this.settings.response === 'FAST' ? 0.125 : 1;
    const digital = dbfs(Math.sqrt(this.smoother.update(data.rms ** 2, data.seconds, tau)));
    const aLevel = dbfs(Math.sqrt(data.aEnergy));
    const aDisplay = dbfs(Math.sqrt(this.aSmoother.update(data.aEnergy, data.seconds, tau)));
    this.leq.add(data.aEnergy, data.seconds);
    const offset = this.state.calibrated ? this.settings.calibration!.offset : null;
    const dba = offset === null ? null : aDisplay + offset;
    this.maxDigital = Math.max(this.maxDigital, data.dbfs);
    this.maxA = Math.max(this.maxA, aLevel);
    const clipEvents = this.state.clipEvents + (data.clips > 0 && !this.lastClip ? 1 : 0);
    this.lastClip = data.clips > 0;
    if (data.clips > 0) this.clipUntil = elapsed + 1;
    if (this.calibrating) {
      this.calibrationLevels.push(aLevel);
      if (this.calibrationLevels.length > 60) this.calibrationLevels.shift();
      this.calibrationClips ||= data.clips > 0;
    }
    let beat = this.state.beat,
      beatMode = this.state.beatMode;
    const phaseReliable = this.state.bpmConfidence > 0.25 && Number.isFinite(this.nextBeat);
    const nearTrackedBeat = !phaseReliable || Math.abs(data.time - this.nextBeat) < 0.13;
    if (data.onset && nearTrackedBeat && data.time - this.lastBeat > 0.2) {
      beat = performance.now();
      beatMode = 'onset';
      this.lastBeat = data.time;
    } else if (data.time >= this.nextBeat && this.state.bpm && data.time - this.lastBeat > 0.2) {
      beat = performance.now();
      beatMode = 'predicted';
      this.lastBeat = data.time;
      this.nextBeat += 60 / this.state.bpm;
    }
    if (this.state.bpm && this.nextBeat < data.time)
      this.nextBeat = data.time + 60 / this.state.bpm;
    let bpm = this.state.bpm,
      confidence = this.state.bpmConfidence;
    this.quietSeconds = data.dbfs < -80 ? this.quietSeconds + data.seconds : 0;
    if (elapsed - this.lastTempoAt > 12 || this.quietSeconds >= 3) {
      bpm = null;
      confidence = 0;
      this.nextBeat = Infinity;
    }
    this.historySeconds += data.seconds;
    this.historyEnergy += data.rms ** 2 * data.seconds;
    this.historyAEnergy += data.aEnergy * data.seconds;
    let history = this.state.history;
    if (this.historySeconds >= 1) {
      history = [
        ...history,
        {
          timestamp: elapsed,
          dbfs: dbfs(Math.sqrt(this.historyEnergy / this.historySeconds)),
          dba:
            offset === null
              ? null
              : dbfs(Math.sqrt(this.historyAEnergy / this.historySeconds)) + offset,
          bpm,
          confidence,
        },
      ].filter((p) => elapsed - p.timestamp <= 900);
      this.historySeconds = this.historyEnergy = this.historyAEnergy = 0;
    }
    this.update({
      dbfs: digital,
      rawDbfs: data.dbfs,
      rms: data.rms,
      peak: data.peak,
      clipping: elapsed < this.clipUntil,
      clipEvents,
      dba,
      laeq1m: offset === null ? null : this.leq.level + offset,
      leqSeconds: this.leq.duration,
      maxLevel: offset === null ? this.maxDigital : this.maxA + offset,
      elapsed,
      history,
      beat,
      beatMode,
      bpm,
      bpmConfidence: confidence,
      dropped: data.dropped,
    });
  }
  beginCalibration() {
    if (!this.state.running) throw new Error('Inicia el micrófono antes de calibrar.');
    this.calibrationLevels = [];
    this.calibrationClips = false;
    this.calibrating = true;
  }
  cancelCalibration() {
    this.calibrating = false;
    this.calibrationLevels = [];
  }
  finishCalibration(reference: number): Calibration {
    if (!this.state.running || this.state.suspended)
      throw new Error('El micrófono debe estar activo.');
    if (!this.state.deviceId)
      throw new Error(
        'El navegador no identifica este micrófono; no se puede asociar la calibración.',
      );
    if (this.calibrationClips)
      throw new Error('Hay clipping. Reduce la ganancia y repite la captura.');
    const offset = calibrationOffset(reference, this.calibrationLevels);
    this.cancelCalibration();
    return {
      offset,
      date: new Date().toISOString(),
      deviceId: this.state.deviceId,
      deviceLabel: this.state.deviceLabel,
      sampleRate: this.state.sampleRate,
      reference,
      weighting: 'A',
    };
  }
  async resume() {
    try {
      await this.context?.resume();
    } catch {
      this.update({ error: 'AUDIO_CONTEXT_FAILED' });
    }
  }
  async stop() {
    ++this.generation;
    const closing = this.release();
    this.update({ running: false, starting: false, suspended: false, rhythmStatus: 'off' });
    await closing;
  }
  private async release() {
    this.cancelCalibration();
    this.worker?.terminate();
    this.worker = undefined;
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = undefined;
    this.source?.disconnect();
    this.source = undefined;
    this.node?.disconnect();
    if (this.node) {
      this.node.port.onmessage = null;
      this.node.port.close();
      this.node.onprocessorerror = null;
    }
    this.node = undefined;
    const context = this.context;
    this.context = undefined;
    if (context) {
      context.onstatechange = null;
      if (context.state !== 'closed') await context.close();
    }
  }
  destroy() {
    void this.stop();
    this.listeners.clear();
  }
}
