import { resample } from '../dsp/resample';
interface Vector {
  size(): number;
  get(i: number): number;
  delete(): void;
}
interface RhythmResult {
  bpm: number;
  confidence: number;
  ticks: Vector;
  estimates: Vector;
  bpmIntervals: Vector;
}
interface EssentiaAPI {
  arrayToVector(x: Float32Array): Vector;
  RhythmExtractor2013(x: Vector, max: number, method: string, min: number): RhythmResult;
}
interface WasmModule {
  calledRun?: boolean;
  onRuntimeInitialized?: () => void;
  onAbort?: (reason: unknown) => void;
}
export class EssentiaEngine {
  private api!: EssentiaAPI;
  async initialize(base: string) {
    // Official ES distribution contains its WASM binary. Served locally verbatim;
    // dynamic import is isolated in the worker, no CDN or main-thread WASM startup.
    const { EssentiaWASM } = (await import(
      /* @vite-ignore */ `${base}vendor/essentia-wasm.es.js`
    )) as { EssentiaWASM: WasmModule };
    if (!EssentiaWASM.calledRun)
      await new Promise<void>((resolve, reject) => {
        EssentiaWASM.onRuntimeInitialized = resolve;
        EssentiaWASM.onAbort = reject;
      });
    const { default: Essentia } = (await import(
      /* @vite-ignore */ `${base}vendor/essentia.js-core.es.js`
    )) as { default: new (module: WasmModule) => EssentiaAPI };
    this.api = new Essentia(EssentiaWASM);
  }
  analyze(samples: Float32Array, rate: number, min: number, max: number) {
    const original = this.api.arrayToVector(resample(samples, rate));
    let result: RhythmResult | undefined;
    try {
      result = this.api.RhythmExtractor2013(original, max, 'multifeature', min);
      const ticks = Array.from({ length: result.ticks.size() }, (_, i) => result!.ticks.get(i));
      return { bpm: result.bpm, confidence: result.confidence, ticks };
    } finally {
      original.delete();
      result?.ticks.delete();
      result?.estimates.delete();
      result?.bpmIntervals.delete();
    }
  }
}
