import { EssentiaEngine } from '../audio/rhythm/EssentiaEngine';
import { TempoTracker } from '../audio/rhythm/TempoTracker';

const engine = new EssentiaEngine();
let tracker = new TempoTracker();
let ring = new Float32Array(0),
  write = 0,
  count = 0,
  since = 0,
  rate = 44100,
  min = 40,
  max = 220,
  dropped = 0,
  lastTime = 0,
  isAnalyzing = false;
let port: MessagePort;

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      rate = data.rate;
      min = data.min;
      max = data.max;
      // 8-second buffer provides high precision and fast WASM execution
      ring = new Float32Array(Math.ceil(rate * 8));
      await engine.initialize(data.base);
      port = data.port;
      port.onmessage = ({ data }: { data: { samples: Float32Array; endTime: number } }) => {
        const block = data.samples;
        if (lastTime && data.endTime - lastTime > (block.length / rate) * 1.5) {
          // Do not concatenate across dropped audio: timestamps/tempo would be false.
          dropped++;
          count = 0;
          since = 0;
          write = 0;
        }
        lastTime = data.endTime;
        for (let i = 0; i < block.length; i++) {
          ring[write] = block[i];
          write = (write + 1) % ring.length;
        }
        count = Math.min(ring.length, count + block.length);
        since += block.length;

        // Fast warm-up: initial detection triggers at ~3.2 seconds instead of waiting 10s!
        const minWarmupSamples = Math.ceil(rate * 3.2);
        const hopSamples = count < ring.length ? Math.ceil(rate * 0.8) : Math.ceil(rate * 1.0);

        if (!isAnalyzing && count >= minWarmupSamples && since >= hopSamples) {
          since = 0;
          isAnalyzing = true;

          const currentLen = Math.min(count, ring.length);
          const samples = new Float32Array(currentLen);
          const start = (write - currentLen + ring.length) % ring.length;
          if (start + currentLen <= ring.length) {
            samples.set(ring.subarray(start, start + currentLen));
          } else {
            const firstPart = ring.length - start;
            samples.set(ring.subarray(start));
            samples.set(ring.subarray(0, currentLen - firstPart), firstPart);
          }

          let energy = 0;
          const stride = Math.max(1, Math.floor(samples.length / 2000));
          for (let i = 0; i < samples.length; i += stride) energy += samples[i] * samples[i];
          const meanEnergy = energy / Math.ceil(samples.length / stride);

          if (meanEnergy < 1e-8) {
            tracker = new TempoTracker();
            self.postMessage({
              type: 'tempo',
              raw: null,
              stable: null,
              confidence: 0,
              ticks: [],
              dropped,
            });
            isAnalyzing = false;
          } else {
            try {
              const r = engine.analyze(samples, rate, min, max);
              const ticks = r.ticks.map((t) => data.endTime - currentLen / rate + t);
              self.postMessage({
                type: 'tempo',
                ...tracker.update(r.bpm, r.confidence, min, max, r.ticks.length),
                ticks,
                dropped,
              });
            } catch (error) {
              console.warn('Essentia analysis failed:', error);
              self.postMessage({ type: 'error', error: 'ESSENTIA_ANALYSIS_FAILED' });
            } finally {
              isAnalyzing = false;
            }
          }
        }
        port.postMessage({ type: 'recycle', buffer: block.buffer }, [block.buffer]);
      };
      port.start();
      self.postMessage({ type: 'ready' });
    } catch {
      self.postMessage({ type: 'error', error: 'ESSENTIA_LOAD_FAILED' });
    }
  }
};
