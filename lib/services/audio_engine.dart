import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:audio_streamer/audio_streamer.dart';
import 'package:permission_handler/permission_handler.dart';
import '../dsp/a_weighting.dart';
import '../dsp/calibration.dart';
import '../dsp/leq.dart';
import '../dsp/levels.dart';
import '../rhythm/onset_detector.dart';
import '../rhythm/tempo_cnn_engine.dart';
import '../rhythm/tempo_tracker.dart';
import 'settings_service.dart';

class AudioEngineState {
  final bool isRunning;
  final double dbfs;
  final double? dba;
  final double rms;
  final double peak;
  final bool isClipping;
  final int clipEvents;
  final bool isCalibrated;
  final String calibrationMode; // 'manual', 'auto', 'none'
  final double autoOffset;
  final double? laeq1m;
  final double leqSeconds;
  final double? maxLevel;
  final double? bpm;
  final double? rawBpm;
  final double bpmConfidence;
  final List<double> candidates;
  final bool isBeatActive;
  final String beatMode;
  final List<HistoryEntry> history;
  final String rhythmStatus;

  AudioEngineState({
    this.isRunning = false,
    this.dbfs = -100.0,
    this.dba,
    this.rms = 0.0,
    this.peak = -100.0,
    this.isClipping = false,
    this.clipEvents = 0,
    this.isCalibrated = false,
    this.calibrationMode = 'none',
    this.autoOffset = 100.0,
    this.laeq1m,
    this.leqSeconds = 0.0,
    this.maxLevel,
    this.bpm,
    this.rawBpm,
    this.bpmConfidence = 0.0,
    this.candidates = const [],
    this.isBeatActive = false,
    this.beatMode = 'waiting',
    this.history = const [],
    this.rhythmStatus = 'off',
  });
}

class HistoryEntry {
  final double timestamp;
  final double dbfs;
  final double? dba;
  final double? bpm;

  HistoryEntry({
    required this.timestamp,
    required this.dbfs,
    this.dba,
    this.bpm,
  });
}

class AudioEngine extends ChangeNotifier {
  final SettingsService settings;
  AudioStreamer? _streamer;
  StreamSubscription<List<double>>? _audioSub;

  AudioEngineState _state = AudioEngineState();
  AudioEngineState get state => _state;

  final AWeightingFilter _aFilter = AWeightingFilter(44100);
  final AutoCalibrator _autoCalibrator = AutoCalibrator(100.0);
  final LeqIntegrator _leq = LeqIntegrator(windowSeconds: 60.0);
  final OnsetDetector _onsetDetector = OnsetDetector();
  final TempoTracker _tempoTracker = TempoTracker();
  final NeuralTempoEngine _neuralEngine = NeuralTempoEngine();

  // Búfer progresivo para análisis rítmico (TempoCNN / BeatNet)
  final List<double> _ringBuffer = [];
  static const int _sampleRate = 44100;
  static const int _maxRingSamples = _sampleRate * 8; // 8 segundos

  int _sinceLastRhythm = 0;
  bool _isAnalyzingRhythm = false;
  double _elapsed = 0.0;
  double _maxDigital = -100.0;
  double _maxA = -100.0;
  int _clipEvents = 0;

  DateTime? _lastBeatTime;
  double _historySeconds = 0.0;
  double _historyEnergy = 0.0;
  double _historyAEnergy = 0.0;
  final List<HistoryEntry> _history = [];

  AudioEngine(this.settings);

  Future<bool> start() async {
    final status = await Permission.microphone.request();
    if (status != PermissionStatus.granted) {
      return false;
    }

    await _neuralEngine.initializeModel();
    _resetInternals();

    _streamer = AudioStreamer();
    _state = AudioEngineState(isRunning: true, rhythmStatus: 'ready');
    notifyListeners();

    _audioSub = _streamer!.audioStream.listen(
      _processAudioBuffer,
      onError: (err) {
        debugPrint('AudioStreamer error: $err');
      },
      cancelOnError: false,
    );
    return true;
  }

  Future<void> stop() async {
    await _audioSub?.cancel();
    _audioSub = null;
    _streamer = null;

    _state = AudioEngineState(isRunning: false, rhythmStatus: 'off');
    notifyListeners();
  }

  void _resetInternals() {
    _aFilter.reset();
    _autoCalibrator.reset();
    _leq.reset();
    _onsetDetector.reset();
    _tempoTracker.reset();
    _ringBuffer.clear();
    _sinceLastRhythm = 0;
    _isAnalyzingRhythm = false;
    _elapsed = 0.0;
    _maxDigital = -100.0;
    _maxA = -100.0;
    _clipEvents = 0;
    _historySeconds = 0.0;
    _historyEnergy = 0.0;
    _historyAEnergy = 0.0;
    _history.clear();
  }

  void _processAudioBuffer(List<double> samples) {
    if (!_state.isRunning || samples.isEmpty) return;

    final int sampleCount = samples.length;
    final List<double> aSamples = List<double>.filled(sampleCount, 0.0);

    for (int i = 0; i < sampleCount; i++) {
      final double s = samples[i].isFinite ? samples[i] : 0.0;
      aSamples[i] = _aFilter.process(s);
    }

    final double dt = sampleCount / _sampleRate;
    _elapsed += dt;

    // Métricas de nivel
    final double rawRms = calculateRms(samples);
    final double digitalDbfs = dbfs(rawRms);
    final double aRms = calculateRms(aSamples);
    final double aDbfs = dbfs(aRms);
    final double peakVal = calculatePeak(samples);
    final int clips = countClipping(samples);

    if (clips > 0) _clipEvents++;

    // Integración de energía LEQ (60 segundos)
    _leq.add(aRms * aRms, dt);

    // Auto-calibración adaptativa dBA
    _autoCalibrator.update(aDbfs, dt);
    final double autoOffset = _autoCalibrator.offset;

    final bool hasManual = settings.calibration != null;
    final bool autoActive = !hasManual && settings.autoCalibrate;

    double? effectiveOffset;
    String mode = 'none';

    if (hasManual) {
      effectiveOffset = settings.calibration!.offset;
      mode = 'manual';
    } else if (autoActive) {
      effectiveOffset = autoOffset;
      mode = 'auto';
    }

    final bool isCalibrated = effectiveOffset != null;
    final double? dba = isCalibrated ? aDbfs + effectiveOffset! : null;

    _maxDigital = math.max(_maxDigital, digitalDbfs);
    if (aDbfs.isFinite) _maxA = math.max(_maxA, aDbfs);

    // Detección de pulso de golpe (Onset)
    final bool isOnset = _onsetDetector.processBlock(samples);
    if (isOnset) {
      _lastBeatTime = DateTime.now();
    }

    final bool isBeatActive = _lastBeatTime != null &&
        DateTime.now().difference(_lastBeatTime!).inMilliseconds < 160;

    // Acumulador de búfer rítmico (TempoCNN / BeatNet)
    _ringBuffer.addAll(samples);
    if (_ringBuffer.length > _maxRingSamples) {
      _ringBuffer.removeRange(0, _ringBuffer.length - _maxRingSamples);
    }
    _sinceLastRhythm += sampleCount;

    // Activación rápida de tempo: primera inferencia a los ~3.2s
    final int minWarmup = (_sampleRate * 3.2).toInt();
    final int hopSamples = _ringBuffer.length < _maxRingSamples
        ? (_sampleRate * 0.8).toInt()
        : (_sampleRate * 1.0).toInt();

    if (!_isAnalyzingRhythm && _ringBuffer.length >= minWarmup && _sinceLastRhythm >= hopSamples) {
      _sinceLastRhythm = 0;
      _triggerRhythmAnalysis();
    }

    // Historial para gráficas
    _historySeconds += dt;
    _historyEnergy += rawRms * rawRms * dt;
    _historyAEnergy += aRms * aRms * dt;

    if (_historySeconds >= 1.0) {
      final double histDbfs = dbfs(math.sqrt(_historyEnergy / _historySeconds));
      final double? histDba = isCalibrated
          ? dbfs(math.sqrt(_historyAEnergy / _historySeconds)) + effectiveOffset!
          : null;

      _history.add(HistoryEntry(
        timestamp: _elapsed,
        dbfs: histDbfs,
        dba: histDba,
        bpm: _state.bpm,
      ));
      if (_history.length > 900) _history.removeAt(0);

      _historySeconds = 0.0;
      _historyEnergy = 0.0;
      _historyAEnergy = 0.0;
    }

    _state = AudioEngineState(
      isRunning: true,
      dbfs: digitalDbfs,
      dba: dba,
      rms: rawRms,
      peak: dbfs(peakVal),
      isClipping: clips > 0,
      clipEvents: _clipEvents,
      isCalibrated: isCalibrated,
      calibrationMode: mode,
      autoOffset: autoOffset,
      laeq1m: isCalibrated ? _leq.level + effectiveOffset! : null,
      leqSeconds: _leq.duration,
      maxLevel: isCalibrated ? _maxA + effectiveOffset! : _maxDigital,
      bpm: _state.bpm,
      rawBpm: _state.rawBpm,
      bpmConfidence: _state.bpmConfidence,
      candidates: _state.candidates,
      isBeatActive: isBeatActive,
      beatMode: isOnset ? 'onset' : 'predicted',
      history: List.unmodifiable(_history),
      rhythmStatus: _neuralEngine.activeModel,
    );
    notifyListeners();
  }

  void _triggerRhythmAnalysis() {
    _isAnalyzingRhythm = true;
    final bufferCopy = Float32List.fromList(_ringBuffer);

    final result = _neuralEngine.analyze(
      bufferCopy,
      _sampleRate,
      settings.minBpm,
      settings.maxBpm,
    );

    final tempo = _tempoTracker.update(
      result.bpm,
      result.confidence,
      min: settings.minBpm,
      max: settings.maxBpm,
      ticksCount: result.ticks.length,
    );

    _isAnalyzingRhythm = false;

    _state = AudioEngineState(
      isRunning: _state.isRunning,
      dbfs: _state.dbfs,
      dba: _state.dba,
      rms: _state.rms,
      peak: _state.peak,
      isClipping: _state.isClipping,
      clipEvents: _state.clipEvents,
      isCalibrated: _state.isCalibrated,
      calibrationMode: _state.calibrationMode,
      autoOffset: _state.autoOffset,
      laeq1m: _state.laeq1m,
      leqSeconds: _state.leqSeconds,
      maxLevel: _state.maxLevel,
      bpm: tempo.stable,
      rawBpm: tempo.raw,
      bpmConfidence: tempo.confidence,
      candidates: tempo.candidates,
      isBeatActive: _state.isBeatActive,
      beatMode: _state.beatMode,
      history: _state.history,
      rhythmStatus: _neuralEngine.activeModel,
    );
    notifyListeners();
  }
}
