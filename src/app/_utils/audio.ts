import { clamp } from './utils';
import { MAX_MONITOR_DELAY_MS } from './types';
import type {
  ActiveInputAnalyser,
  ActiveOutputGraph,
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
): Promise<ActiveInputAnalyser> {
  const context = createAudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();

  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.72;

  source.connect(analyser);

  await context.resume();

  const cancelLoop = startLevelLoop(analyser, setInputLevel);

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
  onEnded,
  routeStreamToOutput,
  setOutputLevel,
  toneFrequency,
}: {
  kind: Exclude<SpeakerTestKind, 'music'>;
  onEnded: () => void;
  routeStreamToOutput: (stream: MediaStream) => Promise<void>;
  setOutputLevel: LevelSetter;
  toneFrequency: number;
}): Promise<ActiveOutputGraph> {
  const context = createAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const modulation = context.createOscillator();
  const modulationGain = context.createGain();
  const analyser = context.createAnalyser();
  const destination = context.createMediaStreamDestination();
  const durationSeconds =
    kind === 'sweep' ? 8 : kind === 'modulatedTone' ? 6 : 3;
  const durationMs =
    kind === 'sweep' ? 8000 : kind === 'modulatedTone' ? 6000 : 3000;
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
  const stopAt = startAt + durationSeconds;

  oscillator.frequency.setValueAtTime(frequency, startAt);

  if (kind === 'modulatedTone') {
    modulation.frequency.setValueAtTime(5, startAt);
    modulationGain.gain.setValueAtTime(frequency * 0.06, startAt);
  }

  if (kind === 'sweep') {
    oscillator.frequency.exponentialRampToValueAtTime(
      clamp(frequency * 4, 160, 12000),
      stopAt,
    );
  }

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.18, startAt + 0.025);
  gain.gain.setValueAtTime(0.18, Math.max(startAt, stopAt - 0.035));
  gain.gain.linearRampToValueAtTime(0, stopAt);

  oscillator.start(startAt);
  oscillator.stop(stopAt);
  if (kind === 'modulatedTone') {
    modulation.start(startAt);
    modulation.stop(stopAt);
  }

  const cancelLevelLoop = startLevelLoop(analyser, setOutputLevel);
  const stopTimer = window.setTimeout(
    onEnded,
    durationMs + SOURCE_START_DELAY_SECONDS * 1000 + 80,
  );

  return {
    context,
    mode: 'speakerTest',
    cancel: () => {
      window.clearTimeout(stopTimer);
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
  onEnded,
  routeStreamToOutput,
  setOutputLevel,
  startAtSeconds = 0,
}: {
  getArrayBuffer: () => Promise<ArrayBuffer>;
  onEnded: () => void;
  routeStreamToOutput: (stream: MediaStream) => Promise<void>;
  setOutputLevel: LevelSetter;
  startAtSeconds?: number;
}): Promise<ActiveOutputGraph> {
  const context = createAudioContext();
  const audioBuffer = await context.decodeAudioData(await getArrayBuffer());
  const analyser = context.createAnalyser();
  const destination = context.createMediaStreamDestination();

  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.68;

  analyser.connect(destination);

  await routeStreamToOutput(destination.stream);
  await context.resume();
  await warmOutputPipeline();

  const cancelLevelLoop = startLevelLoop(analyser, setOutputLevel);
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
    nextSource.connect(analyser);

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
  }

  playFrom(startAtSeconds);

  return {
    context,
    durationSeconds: audioBuffer.duration,
    getCurrentTime,
    isPaused: () => !isPlaying,
    mode: 'speakerTest',
    pause,
    playFrom,
    cancel: () => {
      isCancelled = true;
      cancelLevelLoop();
      disconnectSource();
      analyser.disconnect();
    },
  };
}

export async function createMonitorOutputGraph({
  delayMs,
  routeStreamToOutput,
  setOutputLevel,
  stream,
}: {
  delayMs: number;
  routeStreamToOutput: (stream: MediaStream) => Promise<void>;
  setOutputLevel: LevelSetter;
  stream: MediaStream;
}): Promise<ActiveOutputGraph> {
  const context = createAudioContext();
  const source = context.createMediaStreamSource(stream);
  const delay = context.createDelay(MAX_MONITOR_DELAY_MS / 1000);
  const analyser = context.createAnalyser();
  const destination = context.createMediaStreamDestination();

  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.7;
  delay.delayTime.value = delayMs / 1000;

  source.connect(delay);
  delay.connect(analyser);
  analyser.connect(destination);

  await routeStreamToOutput(destination.stream);
  await context.resume();

  const cancelLevelLoop = startLevelLoop(analyser, setOutputLevel);

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
}: {
  blob: Blob;
  onEnded: () => void;
  routeStreamToOutput: (stream: MediaStream) => Promise<void>;
  setOutputLevel: LevelSetter;
}): Promise<ActiveOutputGraph> {
  const context = createAudioContext();
  const audioBuffer = await context.decodeAudioData(await blob.arrayBuffer());
  const source = context.createBufferSource();
  const analyser = context.createAnalyser();
  const destination = context.createMediaStreamDestination();

  source.buffer = audioBuffer;
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.68;

  source.connect(analyser);
  analyser.connect(destination);

  await routeStreamToOutput(destination.stream);
  await context.resume();
  await warmOutputPipeline();

  const cancelLevelLoop = startLevelLoop(analyser, setOutputLevel);
  source.onended = onEnded;

  source.start(context.currentTime + SOURCE_START_DELAY_SECONDS);

  return {
    context,
    mode: 'clip',
    cancel: () => {
      cancelLevelLoop();
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Buffer source may already be stopped by playback end.
      }
      source.disconnect();
      analyser.disconnect();
    },
  };
}

async function warmOutputPipeline() {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, OUTPUT_PIPELINE_WARMUP_MS);
  });
}

export function startLevelLoop(analyser: AnalyserNode, setLevel: LevelSetter) {
  const buffer = new Uint8Array(analyser.fftSize);
  let frame = 0;
  let lastUpdateAt = 0;

  const tick = () => {
    analyser.getByteTimeDomainData(buffer);
    const nextLevel = getSignalLevel(buffer);
    const now = performance.now();

    if (now - lastUpdateAt >= 32) {
      lastUpdateAt = now;
      setLevel(nextLevel);
    }

    frame = window.requestAnimationFrame(tick);
  };

  tick();

  return () => {
    window.cancelAnimationFrame(frame);
    setLevel(0);
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

function getSignalLevel(buffer: Uint8Array) {
  let sumSquares = 0;
  let peak = 0;

  for (const sample of buffer) {
    const normalized = (sample - 128) / 128;
    const absolute = Math.abs(normalized);

    sumSquares += normalized * normalized;
    peak = Math.max(peak, absolute);
  }

  const rms = Math.sqrt(sumSquares / buffer.length);

  return clamp(Math.max(rms * 4.8, peak * 1.15), 0, 1);
}
