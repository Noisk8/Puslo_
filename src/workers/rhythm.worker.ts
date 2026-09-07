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
  lastTime = 0;
let port: MessagePort;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      rate = data.rate;
      min = data.min;
      max = data.max;
      ring = new Float32Array(Math.ceil(rate * 10));
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
        if (count === ring.length && since >= rate * 3) {
          since = 0;
          const samples = new Float32Array(ring.length);
          samples.set(ring.subarray(write));
          samples.set(ring.subarray(0, write), ring.length - write);
          let energy = 0;
          for (const x of samples) energy += x * x;
          if (energy / samples.length < 1e-8) {
            tracker = new TempoTracker();
            self.postMessage({
              type: 'tempo',
              raw: null,
              stable: null,
              confidence: 0,
              ticks: [],
              dropped,
            });
          } else
            try {
              const r = engine.analyze(samples, rate, min, max);
              self.postMessage({
                type: 'tempo',
                ...tracker.update(r.bpm, r.confidence, min, max),
                ticks: r.ticks.map((t) => data.endTime - 10 + t),
                dropped,
              });
            } catch (error) {
              console.warn('Essentia analysis failed:', error);
              self.postMessage({ type: 'error', error: 'ESSENTIA_ANALYSIS_FAILED' });
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
