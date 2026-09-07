export interface LevelBlock {
  rms: number;
  dbfs: number;
  aEnergy: number;
  peak: number;
  clips: number;
  seconds: number;
  time: number;
  onset: boolean;
  dropped: number;
}
export interface HistoryPoint {
  timestamp: number;
  dbfs: number;
  dba: number | null;
  bpm: number | null;
  confidence: number;
}
export interface AudioAnalysisState {
  running: boolean;
  starting: boolean;
  suspended: boolean;
  sampleRate: number;
  deviceId: string;
  deviceLabel: string;
  dbfs: number;
  rawDbfs: number;
  rms: number;
  peak: number;
  clipping: boolean;
  clipEvents: number;
  dba: number | null;
  calibrated: boolean;
  laeq1m: number | null;
  leqSeconds: number;
  maxLevel: number | null;
  bpm: number | null;
  rawBpm: number | null;
  bpmConfidence: number;
  candidates: number[];
  beat: number;
  beatMode: 'onset' | 'predicted' | 'waiting';
  elapsed: number;
  history: HistoryPoint[];
  error: string | null;
  rhythmStatus: 'off' | 'loading' | 'ready' | 'error';
  dropped: number;
  processing: string[];
}
