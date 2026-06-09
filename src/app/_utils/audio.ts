import { clamp } from './utils';
import { MAX_MONITOR_DELAY_MS } from './types';
import type {
  ActiveInputAnalyser,
  ActiveOutputGraph,
  FrequencyLevelSetter,
  LevelSetter,
  SpeakerTestKind,
  WindowWithWebkitAudio,
} from './types';

const preferredMimeTypes = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];
const OUTPUT_PIPELINE_WARMUP_MS = 240;
const SOURCE_START_DELAY_SECONDS = 0.03;
const METER_FLOOR_DB = -48;
const METER_PEAK_HINT_GAIN = 0.72;
const SPECTRUM_BIN_COUNT = 48;
const SPECTRUM_MIN_FREQUENCY_HZ = 40;
const SPECTRUM_MAX_FREQUENCY_HZ = 16000;
const INPUT_METER_OPTIONS = {
  lowEndKnee: 0.55,
  lowEndPower: 1.8,
};

type MeterOptions = {
  lowEndKnee?: number;
  lowEndPower?: number;
};

export function createAudioContext() {
  const AudioContextConstructor =
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error('Web Audio is unavailable in this browser.');
  }

  return new AudioContextConstructor();
}

export async function createInputAnalyser(
  stream: MediaStream,
  setInputLevel: LevelSetter,
  setInputSpectrum?: FrequencyLevelSetter,
): Promise<ActiveInputAnalyser> {
  const context = createAudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();

  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0;

  source.connect(analyser);

  await context.resume();

  const cancelLoop = startLevelLoop(
    analyser,
    setInputLevel,
    INPUT_METER_OPTIONS,
    setInputSpectrum,
  );

  return {
    context,
    stream,
    cancel: () => {
      cancelLoop();
      source.disconnect();
      analyser.disconnect();
    },
  };
}

export async function createSpeakerTestOutputGraph({
  kind,
  routeStreamToOutput,
  setOutputLevel,
  setOutputSpectrum,
  toneFrequency,
}: {
  kind: Exclude<SpeakerTestKind, 'dialUp' | 'music'>;
  routeStreamToOutput: (stream: MediaStream) => Promise<void>;
  setOutputLevel: LevelSetter;
  setOutputSpectrum?: FrequencyLevelSetter;
  toneFrequency: number;
}): Promise<ActiveOutputGraph> {
  const context = createAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const modulation = context.createOscillator();
  const modulationGain = context.createGain();
  const analyser = context.createAnalyser();
  const destination = context.createMediaStreamDestination();
  const frequency = clamp(toneFrequency, 40, 12000);

  analyser.fftSize = 1024;
  oscillator.type = 'sine';

  if (kind === 'modulatedTone') {
    modulation.connect(modulationGain);
    modulationGain.connect(oscillator.frequency);
  }

  oscillator.connect(gain);
  gain.connect(analyser);
  analyser.connect(destination);

  await routeStreamToOutput(destination.stream);
  await context.resume();
  await warmOutputPipeline();

  const startAt = context.currentTime + SOURCE_START_DELAY_SECONDS;
  const setToneFrequency = (nextFrequency: number) => {
    const safeFrequency = clamp(nextFrequency, 40, 12000);

    oscillator.frequency.setValueAtTime(safeFrequency, context.currentTime);

    if (kind === 'modulatedTone') {
      modulationGain.gain.setValueAtTime(
        safeFrequency * 0.06,
        context.currentTime,
      );
    }
  };

  oscillator.frequency.setValueAtTime(frequency, startAt);

  if (kind === 'modulatedTone') {
    modulation.frequency.setValueAtTime(5, startAt);
    modulationGain.gain.setValueAtTime(frequency * 0.06, startAt);
  }

  if (kind === 'sweep') {
    oscillator.frequency.exponentialRampToValueAtTime(
      clamp(frequency * 4, 160, 12000),
      startAt + 8,
    );
  }

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.18, startAt + 0.025);

  oscillator.start(startAt);
  if (kind === 'modulatedTone') {
    modulation.start(startAt);
  }

  const cancelLevelLoop = startLevelLoop(
    analyser,
    setOutputLevel,
    {},
    setOutputSpectrum,
  );

  return {
    context,
    mode: 'speakerTest',
    updateToneFrequency: (nextFrequency) => {
      setToneFrequency(nextFrequency);
    },
    cancel: () => {
      cancelLevelLoop();
      try {
        oscillator.stop();
      } catch {
        // Oscillator may already be stopped by the scheduled end.
      }
      try {
        modulation.stop();
      } catch {
        // Modulator may not have been started or may already be stopped.
      }
      oscillator.disconnect();
      gain.disconnect();
      modulation.disconnect();
      modulationGain.disconnect();
      analyser.disconnect();
    },
  };
}

export async function createMusicOutputGraph({
  getArrayBuffer,
  onDecodeStart,
  onEnded,
  playbackGain = 1,
  routeStreamToOutput,
  setOutputLevel,
  setOutputSpectrum,
  startAtSeconds = 0,
}: {
  getArrayBuffer: () => Promise<ArrayBuffer>;
  onDecodeStart?: () => void;
  onEnded: () => void;
  playbackGain?: number;
  routeStreamToOutput: (stream: MediaStream) => Promise<void>;
  setOutputLevel: LevelSetter;
  setOutputSpectrum?: FrequencyLevelSetter;
  startAtSeconds?: number;
}): Promise<ActiveOutputGraph> {
  const context = createAudioContext();

  try {
    const arrayBuffer = await getArrayBuffer();

    onDecodeStart?.();

    const audioBuffer = await context.decodeAudioData(arrayBuffer);

    return await createAudioBufferOutputGraph({
      audioBuffer,
      context,
      mode: 'speakerTest',
      onEnded,
      playbackGain,
      routeStreamToOutput,
      setOutputLevel,
      setOutputSpectrum,
      startAtSeconds,
    });
  } catch (error) {
    context.close().catch(() => undefined);
    throw error;
  }
}

export async function createMonitorOutputGraph({
  delayMs,
  routeStreamToOutput,
  setOutputLevel,
  setOutputSpectrum,
  stream,
}: {
  delayMs: number;
  routeStreamToOutput: (stream: MediaStream) => Promise<void>;
  setOutputLevel: LevelSetter;
  setOutputSpectrum?: FrequencyLevelSetter;
  stream: MediaStream;
}): Promise<ActiveOutputGraph> {
  const context = createAudioContext();
  const source = context.createMediaStreamSource(stream);
  const delay = context.createDelay(MAX_MONITOR_DELAY_MS / 1000);
  const analyser = context.createAnalyser();
  const destination = context.createMediaStreamDestination();

  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0;
  delay.delayTime.value = delayMs / 1000;

  source.connect(delay);
  delay.connect(analyser);
  analyser.connect(destination);

  await routeStreamToOutput(destination.stream);
  await context.resume();

  const cancelLevelLoop = startLevelLoop(
    analyser,
    setOutputLevel,
    {},
    setOutputSpectrum,
  );

  return {
    context,
    mode: 'monitor',
    updateDelay: (seconds: number) => {
      delay.delayTime.setTargetAtTime(seconds, context.currentTime, 0.02);
    },
    cancel: () => {
      cancelLevelLoop();
      source.disconnect();
      delay.disconnect();
      analyser.disconnect();
    },
  };
}

export async function createClipOutputGraph({
  blob,
  onEnded,
  routeStreamToOutput,
  setOutputLevel,
  setOutputSpectrum,
  startAtSeconds = 0,
}: {
  blob: Blob;
  onEnded: () => void;
  routeStreamToOutput: (stream: MediaStream) => Promise<void>;
  setOutputLevel: LevelSetter;
  setOutputSpectrum?: FrequencyLevelSetter;
  startAtSeconds?: number;
}): Promise<ActiveOutputGraph> {
  const context = createAudioContext();

  try {
    const audioBuffer = await context.decodeAudioData(await blob.arrayBuffer());

    return await createAudioBufferOutputGraph({
      audioBuffer,
      context,
      mode: 'clip',
      onEnded,
      routeStreamToOutput,
      setOutputLevel,
      setOutputSpectrum,
      startAtSeconds,
    });
  } catch (error) {
    context.close().catch(() => undefined);
    throw error;
  }
}

async function createAudioBufferOutputGraph({
  audioBuffer,
  context,
  mode,
  onEnded,
  playbackGain = 1,
  routeStreamToOutput,
  setOutputLevel,
  setOutputSpectrum,
  startAtSeconds,
}: {
  audioBuffer: AudioBuffer;
  context: AudioContext;
  mode: ActiveOutputGraph['mode'];
  onEnded: () => void;
  playbackGain?: number;
  routeStreamToOutput: (stream: MediaStream) => Promise<void>;
  setOutputLevel: LevelSetter;
  setOutputSpectrum?: FrequencyLevelSetter;
  startAtSeconds: number;
}): Promise<ActiveOutputGraph> {
  const analyser = context.createAnalyser();
  const destination = context.createMediaStreamDestination();
  const gain = context.createGain();

  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0;
  gain.gain.value = playbackGain;

  gain.connect(analyser);
  analyser.connect(destination);

  await routeStreamToOutput(destination.stream);
  await context.resume();
  await warmOutputPipeline();

  const cancelLevelLoop = startLevelLoop(
    analyser,
    setOutputLevel,
    {},
    setOutputSpectrum,
  );
  const maxStartOffset = Math.max(audioBuffer.duration - 0.02, 0);
  let source: AudioBufferSourceNode | null = null;
  let sourceOffset = clamp(startAtSeconds, 0, maxStartOffset);
  let sourceStartedAt = context.currentTime;
  let pausedAt = sourceOffset;
  let isPlaying = false;
  let isCancelled = false;

  function getCurrentTime() {
    if (!isPlaying) {
      return pausedAt;
    }

    return clamp(
      sourceOffset + Math.max(0, context.currentTime - sourceStartedAt),
      0,
      audioBuffer.duration,
    );
  }

  function disconnectSource() {
    const activeSource = source;

    source = null;

    if (!activeSource) {
      return;
    }

    activeSource.onended = null;

    try {
      activeSource.stop();
    } catch {
      // Buffer source may already be stopped by playback end.
    }

    activeSource.disconnect();
  }

  function playFrom(offsetSeconds: number) {
    if (isCancelled) {
      return;
    }

    disconnectSource();

    const nextSource = context.createBufferSource();

    sourceOffset = clamp(offsetSeconds, 0, maxStartOffset);
    pausedAt = sourceOffset;
    source = nextSource;
    nextSource.buffer = audioBuffer;
    nextSource.connect(gain);

    const startAt = context.currentTime + SOURCE_START_DELAY_SECONDS;

    sourceStartedAt = startAt;
    isPlaying = true;

    nextSource.onended = () => {
      if (isCancelled || source !== nextSource) {
        return;
      }

      source = null;
      isPlaying = false;
      pausedAt = 0;
      nextSource.disconnect();
      onEnded();
    };

    nextSource.start(startAt, sourceOffset);
  }

  function pause() {
    if (!isPlaying) {
      return;
    }

    pausedAt = getCurrentTime();
    isPlaying = false;
    disconnectSource();
    setOutputLevel(0);
    setOutputSpectrum?.([]);
  }

  playFrom(startAtSeconds);

  return {
    context,
    durationSeconds: audioBuffer.duration,
    getCurrentTime,
    isPaused: () => !isPlaying,
    mode,
    pause,
    playFrom,
    cancel: () => {
      isCancelled = true;
      cancelLevelLoop();
      disconnectSource();
      gain.disconnect();
      analyser.disconnect();
    },
  };
}

async function warmOutputPipeline() {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, OUTPUT_PIPELINE_WARMUP_MS);
  });
}

export function startLevelLoop(
  analyser: AnalyserNode,
  setLevel: LevelSetter,
  meterOptions: MeterOptions = {},
  setSpectrum?: FrequencyLevelSetter,
) {
  analyser.minDecibels = METER_FLOOR_DB;
  analyser.maxDecibels = 0;
  analyser.smoothingTimeConstant = 0;

  const timeDomainBuffer = new Uint8Array(analyser.fftSize);
  const frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);
  let frame = 0;
  let lastUpdateAt = 0;

  const tick = () => {
    analyser.getByteTimeDomainData(timeDomainBuffer);
    const nextLevel = getSignalLevel(timeDomainBuffer, meterOptions);
    const now = performance.now();

    if (now - lastUpdateAt >= 32) {
      lastUpdateAt = now;
      setLevel(nextLevel);

      if (setSpectrum) {
        analyser.getByteFrequencyData(frequencyBuffer);
        setSpectrum(
          getFrequencyLevels(
            frequencyBuffer,
            analyser.context.sampleRate,
            nextLevel,
          ),
        );
      }
    }

    frame = window.requestAnimationFrame(tick);
  };

  tick();

  return () => {
    window.cancelAnimationFrame(frame);
    setLevel(0);
    setSpectrum?.([]);
  };
}

export function getPreferredMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return '';
  }

  return (
    preferredMimeTypes.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) ?? ''
  );
}

function getSignalLevel(buffer: Uint8Array, meterOptions: MeterOptions) {
  let sumSquares = 0;
  let peak = 0;

  for (const sample of buffer) {
    const normalized = (sample - 128) / 128;
    const absolute = Math.abs(normalized);

    sumSquares += normalized * normalized;
    peak = Math.max(peak, absolute);
  }

  const rms = Math.sqrt(sumSquares / buffer.length);
  const rmsLevel = amplitudeToMeterLevel(rms);
  const peakHintLevel = amplitudeToMeterLevel(peak) * METER_PEAK_HINT_GAIN;

  return applyMeterCurve(
    clamp(Math.max(rmsLevel, peakHintLevel), 0, 1),
    meterOptions,
  );
}

function getFrequencyLevels(
  buffer: Uint8Array,
  sampleRate: number,
  currentLevel: number,
) {
  const nyquistFrequency = sampleRate / 2;
  const maxFrequency = Math.min(SPECTRUM_MAX_FREQUENCY_HZ, nyquistFrequency);
  const binFrequencyWidth = nyquistFrequency / buffer.length;
  const rawLevels = Array.from({ length: SPECTRUM_BIN_COUNT }, (_, index) => {
    const startRatio = index / SPECTRUM_BIN_COUNT;
    const endRatio = (index + 1) / SPECTRUM_BIN_COUNT;
    const startFrequency =
      SPECTRUM_MIN_FREQUENCY_HZ *
      Math.pow(maxFrequency / SPECTRUM_MIN_FREQUENCY_HZ, startRatio);
    const endFrequency =
      SPECTRUM_MIN_FREQUENCY_HZ *
      Math.pow(maxFrequency / SPECTRUM_MIN_FREQUENCY_HZ, endRatio);
    const startIndex = Math.max(
      0,
      Math.floor(startFrequency / binFrequencyWidth),
    );
    const endIndex = Math.max(
      startIndex + 1,
      Math.ceil(endFrequency / binFrequencyWidth),
    );
    let peak = 0;

    for (
      let bufferIndex = startIndex;
      bufferIndex <= endIndex && bufferIndex < buffer.length;
      bufferIndex += 1
    ) {
      peak = Math.max(peak, buffer[bufferIndex] ?? 0);
    }

    return clamp(peak / 255, 0, 1);
  });
  const maxLevel = Math.max(0, ...rawLevels);

  if (maxLevel <= 0 || currentLevel <= maxLevel) {
    return rawLevels;
  }

  const scale = currentLevel / maxLevel;

  return rawLevels.map((level) => clamp(level * scale, 0, 1));
}

function amplitudeToMeterLevel(amplitude: number) {
  if (amplitude <= 0) {
    return 0;
  }

  const decibels = 20 * Math.log10(amplitude);

  return clamp((decibels - METER_FLOOR_DB) / Math.abs(METER_FLOOR_DB), 0, 1);
}

function applyMeterCurve(level: number, meterOptions: MeterOptions) {
  const lowEndKnee = meterOptions.lowEndKnee ?? 0;
  const lowEndPower = meterOptions.lowEndPower ?? 1;

  if (lowEndKnee <= 0 || lowEndPower <= 1 || level >= lowEndKnee) {
    return level;
  }

  return lowEndKnee * Math.pow(level / lowEndKnee, lowEndPower);
}
