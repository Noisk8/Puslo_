import { dbfs } from './levels';
/** Rolling time-weighted energy. Includes partial boundary blocks, never averages dB. */
export class Leq {
  private blocks: { energy: number; seconds: number }[] = [];
  duration = 0;
  private sum = 0;
  constructor(private windowSeconds = 60) {}
  add(energy: number, seconds: number) {
    if (!Number.isFinite(energy) || energy < 0 || !Number.isFinite(seconds) || seconds <= 0) return;
    this.blocks.push({ energy, seconds });
    this.duration += seconds;
    this.sum += energy * seconds;
    while (this.duration > this.windowSeconds && this.blocks.length) {
      const first = this.blocks[0];
      const remove = Math.min(first.seconds, this.duration - this.windowSeconds);
      this.sum -= first.energy * remove;
      this.duration -= remove;
      first.seconds -= remove;
      if (first.seconds < 1e-8) this.blocks.shift();
    }
  }
  get level() {
    return dbfs(Math.sqrt(Math.max(0, this.sum) / (this.duration || 1)));
  }
}
