/** Band-limited windowed-sinc resampling, confined to the rhythm worker.
 * 64 taps and 1024 fractional phases; Blackman window, 94% Nyquist cutoff.
 * The PCM boundary is zero-padded. This does not affect the level-analysis branch.
 * Method: https://ccrma.stanford.edu/~jos/resample/Windowed_Sinc_Interpolation.html
 * Essentia.js 0.1.3's Resample binding throws in its distributed WASM binary.
 */
export function resample(
  input: Float32Array,
  sourceRate: number,
  targetRate = 44100,
): Float32Array {
  if (
    !Number.isFinite(sourceRate) ||
    !Number.isFinite(targetRate) ||
    sourceRate < 8000 ||
    targetRate < 8000
  )
    throw new Error('Invalid sample rate');
  if (sourceRate === targetRate) return input;
  const taps = 64,
    phases = 1024,
    half = taps / 2;
  const cutoff = Math.min(1, targetRate / sourceRate) * 0.94;
  const table = new Float64Array(taps * phases);
  for (let phase = 0; phase < phases; phase++) {
    let total = 0;
    for (let tap = 0; tap < taps; tap++) {
      const distance = tap - half + 1 - phase / phases;
      const sinc =
        Math.abs(distance) < 1e-10
          ? cutoff
          : Math.sin(Math.PI * cutoff * distance) / (Math.PI * distance);
      const window =
        0.42 +
        0.5 * Math.cos((Math.PI * distance) / half) +
        0.08 * Math.cos((2 * Math.PI * distance) / half);
      const value = sinc * window;
      table[phase * taps + tap] = value;
      total += value;
    }
    for (let tap = 0; tap < taps; tap++) table[phase * taps + tap] /= total;
  }
  const output = new Float32Array(Math.floor((input.length * targetRate) / sourceRate));
  for (let i = 0; i < output.length; i++) {
    const position = (i * sourceRate) / targetRate,
      integer = Math.floor(position),
      phase = Math.floor((position - integer) * phases);
    let sum = 0;
    for (let tap = 0; tap < taps; tap++) {
      const index = integer - half + 1 + tap;
      if (index >= 0 && index < input.length) sum += input[index] * table[phase * taps + tap];
    }
    output[i] = sum;
  }
  return output;
}
