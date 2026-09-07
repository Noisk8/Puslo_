/** Exponential energy smoothing: FAST 125 ms, SLOW 1 s. Display only. */
export class EnergySmoother {
  private value: number | null = null;
  update(energy: number, seconds: number, tau: number): number {
    if (!Number.isFinite(energy) || energy < 0) return this.value ?? 0;
    const alpha = Math.exp(-Math.max(0, seconds) / tau);
    this.value = this.value === null ? energy : alpha * this.value + (1 - alpha) * energy;
    return this.value;
  }
}
