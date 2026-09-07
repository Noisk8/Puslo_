import { dbfs } from '../dsp/levels';
import { AWeighting } from '../dsp/weightingA';
class LevelProcessor extends AudioWorkletProcessor {
  private sum = 0;
  private aSum = 0;
  private peak = 0;
  private count = 0;
  private clips = 0;
  private weighting = new AWeighting(sampleRate);
  private rhythm?: MessagePort;
  private buffers: Float32Array[] = [];
  private pcm?: Float32Array;
  private position = 0;
  private dropped = 0;
  private previousEnergy = 0;
  private lastOnset = -1;
  constructor() {
    super();
    this.port.onmessage = ({ data }) => {
      if (data.type === 'rhythm') {
        this.rhythm = data.port;
        this.buffers = Array.from({ length: 32 }, () => new Float32Array(4096));
        this.pcm = this.buffers.pop();
        this.rhythm!.onmessage = ({ data }) => {
          if (data.type === 'recycle') this.buffers.push(new Float32Array(data.buffer));
        };
        this.rhythm!.start();
      }
    };
  }
  process(inputs: Float32Array[][]) {
    const channels = inputs[0];
    if (!channels?.[0]) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let s = 0;
      for (const channel of channels) s += channel[i] / channels.length;
      if (!Number.isFinite(s)) s = 0;
      const a = this.weighting.process(s);
      this.sum += s * s;
      this.aSum += a * a;
      this.peak = Math.max(this.peak, Math.abs(s));
      this.count++;
      if (Math.abs(s) >= 0.999) this.clips++;
      if (!this.pcm) this.pcm = this.buffers.pop();
      if (this.pcm) {
        this.pcm[this.position++] = s;
        if (this.position === this.pcm.length) {
          this.rhythm!.postMessage(
            { samples: this.pcm, endTime: currentTime + (i + 1) / sampleRate },
            [this.pcm.buffer],
          );
          this.pcm = undefined;
          this.position = 0;
        }
      } else this.dropped++;
    }
    if (this.count >= sampleRate / 10) {
      const rms = Math.sqrt(this.sum / this.count),
        energy = this.sum / this.count;
      const onset =
        energy > Math.max(1e-7, this.previousEnergy * 1.7) && currentTime - this.lastOnset > 0.2;
      if (onset) this.lastOnset = currentTime;
      this.previousEnergy = this.previousEnergy * 0.6 + energy * 0.4;
      this.port.postMessage({
        rms,
        dbfs: dbfs(rms),
        aEnergy: this.aSum / this.count,
        peak: dbfs(this.peak),
        clips: this.clips,
        seconds: this.count / sampleRate,
        time: currentTime,
        onset,
        dropped: this.dropped,
      });
      this.sum = this.aSum = this.peak = this.count = this.clips = 0;
    }
    return true;
  }
}
registerProcessor('level-processor', LevelProcessor);
