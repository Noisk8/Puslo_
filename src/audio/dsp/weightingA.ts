/** A-weighting analog poles from IEC 61672, discretized by bilinear transform.
 * Method: https://www.mathworks.com/help/audio/ref/weightingfilter-system-object.html
 * Three second-order sections, four DC zeros and two Nyquist zeros.
 * Gain normalized at 1 kHz for the ACTUAL sample rate. No compliance claim:
 * bilinear warping increasingly attenuates near Nyquist, especially at low rates.
 */
import { WeightingFilter } from './weighting';
export class AWeighting extends WeightingFilter {
  constructor(rate: number) { super('A', rate); }
}
