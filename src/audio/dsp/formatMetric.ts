import type { Weighting } from './weighting';
export type TimeConstant = 'F' | 'S' | 'eq' | 'peak';
export function formatMetric(value: number | null, weighting: Weighting, time: TimeConstant, calibrated: boolean): string {
  const unit = calibrated ? `dB${weighting}` : 'dBFS';
  const suffix = time === 'F' ? 'F' : time === 'S' ? 'S' : time === 'eq' ? 'eq' : 'peak';
  return value === null || !Number.isFinite(value) ? `— ${unit} (${weighting}${suffix})` : `${value.toFixed(1)} ${unit} (${weighting}${suffix})`;
}
