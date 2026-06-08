'use client';

import {
  type ChangeEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createClipOutputGraph,
  createInputAnalyser,
  createMonitorOutputGraph,
  createMusicOutputGraph,
  createSpeakerTestOutputGraph,
} from './audio';
import {
  applySink,
  fallbackOutputDevice,
  getAudioConstraints,
  getDeviceLabel,
  keepOrPickDevice,
  keepOrPickOutput,
  normalizeOutputs,
  toAudioDevice,
} from './devices';
import {
  createRecordedClipStorageSnapshot,
  loadRecordedClipsFromStorage,
  revokeRecordedClipUrls,
  writeRecordedClipStorageSnapshot,
} from './recordedClipStorage';
import { getInputStatus, getOutputStatus } from './status';
import { speakerMusicTracks } from './speakerMusic';
import {
  DEFAULT_OUTPUT_ID,
  MAX_MONITOR_DELAY_MS,
  SIGNAL_THRESHOLD,
  type ActiveInputAnalyser,
  type ActiveOutputGraph,
  type AudioDevice,
  type FrequencyLevels,
  type MediaDevicesWithOutputPicker,
  type NamedRecordedClip,
  type PermissionState,
  type ProcessingSettingKey,
  type ProcessingSettings,
  type RecordedClip,
  type RoutedMode,
  type SectionSignalState,
  type SpeakerMusicSource,
  type SpeakerTestKind,
  type SpeakerTestSettings,
} from './types';
import { useRecorder } from './useRecorder';
import { clamp, toErrorMessage } from './utils';

const defaultProcessingSettings: ProcessingSettings = {
  autoGainControl: true,
  echoCancellation: true,
  noiseSuppression: true,
};

const defaultSpeakerTestSettings: SpeakerTestSettings = {
  kind: 'tone',
  musicFile: null,
  musicSource: 'blindingLights',
  toneFrequency: 440,
};
const DIAL_UP_AUDIO_PATH = '/audio/dial-up.mp3';
const DIAL_UP_PLAYBACK_GAIN = 3;
const SPECTRUM_PEAK_DECAY_PER_FRAME = 0.025;

type MusicPlaybackState = {
  durationSeconds: number;
  isLoading: boolean;
  isPlaying: boolean;
  marks: MusicMark[];
  positionSeconds: number;
};

type MusicMark = {
  id: string;
  seconds: number;
};

type RecordedPlaybackState = {
  activeClipId: string | null;
  isPlaying: boolean;
  positionsByClipId: Record<string, number>;
};

type OutputSlot = 'monitor' | 'music' | 'recording';

function mergeRecordedClips(
  storedClips: NamedRecordedClip[],
  currentClips: NamedRecordedClip[],
) {
  const currentClipIds = new Set(currentClips.map((clip) => clip.id));
  const nextStoredClips = storedClips.filter(
    (clip) => !currentClipIds.has(clip.id),
  );
  const duplicateStoredClips = storedClips.filter((clip) =>
    currentClipIds.has(clip.id),
  );

  revokeRecordedClipUrls(duplicateStoredClips);

  return [...nextStoredClips, ...currentClips].sort(
    (firstClip, secondClip) => firstClip.createdAt - secondClip.createdAt,
  );
}

function updateFrequencyPeaks(
  currentPeaks: FrequencyLevels,
  nextLevels: FrequencyLevels,
) {
  return nextLevels.map((nextLevel, index) =>
    Math.max(
      nextLevel,
      (currentPeaks[index] ?? 0) - SPECTRUM_PEAK_DECAY_PER_FRAME,
    ),
  );
}

export function useSoundCheck() {
  const musicPlaybackAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordedPlaybackAudioRef = useRef<HTMLAudioElement | null>(null);
  const monitorAudioRef = useRef<HTMLAudioElement | null>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const inputAnalyserRef = useRef<ActiveInputAnalyser | null>(null);
  const musicOutputGraphRef = useRef<ActiveOutputGraph | null>(null);
  const recordedPlaybackOutputGraphRef = useRef<ActiveOutputGraph | null>(null);
  const monitorOutputGraphRef = useRef<ActiveOutputGraph | null>(null);
  const recordedClipsRef = useRef<NamedRecordedClip[]>([]);
  const recordedClipSaveRequestRef = useRef(0);
  const outputSlotLevelsRef = useRef<Record<OutputSlot, number>>({
    monitor: 0,
    music: 0,
    recording: 0,
  });
  const outputSlotSpectraRef = useRef<Record<OutputSlot, FrequencyLevels>>({
    monitor: [],
    music: [],
    recording: [],
  });
  const musicProgressTimerRef = useRef<number | null>(null);
  const recordedProgressTimerRef = useRef<number | null>(null);
  const pendingMusicStartAtRef = useRef<number | null>(null);

  const [isSupported, setIsSupported] = useState(true);
  const [canRouteOutput, setCanRouteOutput] = useState(true);
  const [canRequestOutput, setCanRequestOutput] = useState(false);
  const [permissionState, setPermissionState] =
    useState<PermissionState>('idle');
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([
    fallbackOutputDevice,
  ]);
  const [selectedInputId, setSelectedInputId] = useState('');
  const [selectedOutputId, setSelectedOutputId] = useState(DEFAULT_OUTPUT_ID);
  const [appPaused, setAppPaused] = useState(false);
  const [inputMuted, setInputMuted] = useState(false);
  const [outputMuted, setOutputMuted] = useState(false);
  const [processingEnabled, setProcessingEnabled] = useState(true);
  const [processingSettings, setProcessingSettings] =
    useState<ProcessingSettings>(defaultProcessingSettings);
  const [speakerTestSettings, setSpeakerTestSettings] =
    useState<SpeakerTestSettings>(defaultSpeakerTestSettings);
  const [musicPlayback, setMusicPlayback] = useState<MusicPlaybackState>({
    durationSeconds: 0,
    isLoading: false,
    isPlaying: false,
    marks: [],
    positionSeconds: 0,
  });
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [monitorDelayMs, setMonitorDelayMs] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [inputSpectrum, setInputSpectrum] = useState<FrequencyLevels>([]);
  const [outputSpectrum, setOutputSpectrum] = useState<FrequencyLevels>([]);
  const [inputSpectrumPeaks, setInputSpectrumPeaks] = useState<FrequencyLevels>(
    [],
  );
  const [outputSpectrumPeaks, setOutputSpectrumPeaks] =
    useState<FrequencyLevels>([]);
  const [recordedClips, setRecordedClips] = useState<NamedRecordedClip[]>([]);
  const [isRecordedClipStorageReady, setIsRecordedClipStorageReady] =
    useState(false);
  const [recordedPlayback, setRecordedPlayback] =
    useState<RecordedPlaybackState>({
      activeClipId: null,
      isPlaying: false,
      positionsByClipId: {},
    });
  const [isMusicOutputActive, setIsMusicOutputActive] = useState(false);
  const [isRecordingPlaybackActive, setIsRecordingPlaybackActive] =
    useState(false);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState(
    'Starting microphone when access is available.',
  );
  const [errorMessage, setErrorMessage] = useState('');

  const selectedInputName = useMemo(
    () =>
      getDeviceLabel(
        inputDevices.find((device) => device.deviceId === selectedInputId),
        inputDevices,
        'audioinput',
      ),
    [inputDevices, selectedInputId],
  );

  const selectedOutputName = useMemo(
    () =>
      getDeviceLabel(
        outputDevices.find((device) => device.deviceId === selectedOutputId),
        outputDevices,
        'audiooutput',
      ),
    [outputDevices, selectedOutputId],
  );

  const selectedRecordedClip = useMemo(() => {
    if (!selectedRecordingId) {
      return null;
    }

    return (
      recordedClips.find((clip) => clip.id === selectedRecordingId) ?? null
    );
  }, [recordedClips, selectedRecordingId]);

  const musicPlaybackMode = isMusicOutputActive ? 'speakerTest' : 'idle';
  const recordingPlaybackMode = isRecordingPlaybackActive ? 'clip' : 'idle';
  const activePlaybackMode: Exclude<RoutedMode, 'monitor'> =
    musicPlaybackMode === 'speakerTest' ? 'speakerTest' : recordingPlaybackMode;

  const inputStatus = appPaused
    ? {
        label: 'App is paused. No microphone stream is active.',
        shortLabel: 'Paused',
        tone: 'idle' as const,
      }
    : inputMuted
      ? {
          label: 'Microphone section is muted.',
          shortLabel: 'Muted',
          tone: 'idle' as const,
        }
      : getInputStatus(permissionState, inputLevel);
  const routedMode: RoutedMode =
    activePlaybackMode === 'idle' && monitorEnabled
      ? 'monitor'
      : activePlaybackMode;
  const outputStatus =
    appPaused || outputMuted
      ? {
          label: appPaused
            ? 'App is paused. No output is playing.'
            : 'Speaker section is muted.',
          shortLabel: appPaused ? 'Paused' : 'Muted',
          tone: 'idle' as const,
        }
      : getOutputStatus(routedMode, outputLevel);
  const inputSignalState: SectionSignalState =
    appPaused || inputMuted || permissionState !== 'granted'
      ? 'off'
      : inputLevel >= SIGNAL_THRESHOLD
        ? 'active'
        : 'ready';
  const outputSignalState: SectionSignalState =
    appPaused || outputMuted
      ? 'off'
      : outputLevel >= SIGNAL_THRESHOLD
        ? 'active'
        : 'ready';
  const allAudioStopped = appPaused || (inputMuted && outputMuted);

  const stopMusicProgressLoop = useCallback(() => {
    if (musicProgressTimerRef.current === null) {
      return;
    }

    window.clearInterval(musicProgressTimerRef.current);
    musicProgressTimerRef.current = null;
  }, []);

  const startMusicProgressLoop = useCallback(() => {
    stopMusicProgressLoop();

    const syncMusicPlayback = () => {
      const activeGraph = musicOutputGraphRef.current;

      if (!activeGraph?.getCurrentTime) {
        return;
      }

      const durationSeconds =
        activeGraph.durationSeconds ?? musicPlayback.durationSeconds;
      const positionSeconds = clamp(
        activeGraph.getCurrentTime(),
        0,
        durationSeconds || 0,
      );

      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds,
        isPlaying: !activeGraph.isPaused?.(),
        positionSeconds,
      }));
    };

    syncMusicPlayback();
    musicProgressTimerRef.current = window.setInterval(syncMusicPlayback, 120);
  }, [musicPlayback.durationSeconds, stopMusicProgressLoop]);

  const stopRecordedProgressLoop = useCallback(() => {
    if (recordedProgressTimerRef.current === null) {
      return;
    }

    window.clearInterval(recordedProgressTimerRef.current);
    recordedProgressTimerRef.current = null;
  }, []);

  const startRecordedProgressLoop = useCallback(
    (clipId: string) => {
      stopRecordedProgressLoop();

      const syncRecordedPlayback = () => {
        const activeGraph = recordedPlaybackOutputGraphRef.current;

        if (!activeGraph?.getCurrentTime) {
          return;
        }

        const durationSeconds = activeGraph.durationSeconds ?? 0;
        const positionSeconds = clamp(
          activeGraph.getCurrentTime(),
          0,
          durationSeconds,
        );

        setRecordedPlayback((currentPlayback) => ({
          ...currentPlayback,
          activeClipId: clipId,
          isPlaying: activeGraph.isPaused ? !activeGraph.isPaused() : true,
          positionsByClipId: {
            ...currentPlayback.positionsByClipId,
            [clipId]: positionSeconds,
          },
        }));
      };

      syncRecordedPlayback();
      recordedProgressTimerRef.current = window.setInterval(
        syncRecordedPlayback,
        120,
      );
    },
    [stopRecordedProgressLoop],
  );

  const stopInputAnalyser = useCallback(() => {
    const activeAnalyser = inputAnalyserRef.current;
    if (!activeAnalyser) {
      setInputLevel(0);
      setInputSpectrum([]);
      setInputSpectrumPeaks([]);
      return;
    }

    inputAnalyserRef.current = null;
    activeAnalyser.cancel();
    activeAnalyser.context.close().catch(() => undefined);
    setInputLevel(0);
    setInputSpectrum([]);
    setInputSpectrumPeaks([]);
  }, []);

  const stopInputStream = useCallback(() => {
    stopInputAnalyser();

    inputStreamRef.current?.getTracks().forEach((track) => track.stop());
    inputStreamRef.current = null;
    setPermissionState('idle');
  }, [stopInputAnalyser]);

  const setOutputSlotLevel = useCallback(
    (slot: OutputSlot, nextLevel: SetStateAction<number>) => {
      const computedNextLevel =
        typeof nextLevel === 'function'
          ? nextLevel(outputSlotLevelsRef.current[slot])
          : nextLevel;

      outputSlotLevelsRef.current[slot] = computedNextLevel;
      setOutputLevel(
        Math.max(
          outputSlotLevelsRef.current.monitor,
          outputSlotLevelsRef.current.music,
          outputSlotLevelsRef.current.recording,
        ),
      );
    },
    [],
  );

  const clearOutputSlotLevel = useCallback(
    (slot: OutputSlot) => {
      setOutputSlotLevel(slot, 0);
    },
    [setOutputSlotLevel],
  );

  const setOutputSlotSpectrum = useCallback(
    (slot: OutputSlot, nextSpectrum: FrequencyLevels) => {
      outputSlotSpectraRef.current[slot] = nextSpectrum;

      const spectra = Object.values(outputSlotSpectraRef.current);
      const mergedLength = Math.max(
        0,
        ...spectra.map((spectrum) => spectrum.length),
      );

      if (mergedLength === 0) {
        setOutputSpectrum([]);
        setOutputSpectrumPeaks([]);
        return;
      }

      const mergedSpectrum = Array.from({ length: mergedLength }, (_, index) =>
        Math.max(
          outputSlotSpectraRef.current.monitor[index] ?? 0,
          outputSlotSpectraRef.current.music[index] ?? 0,
          outputSlotSpectraRef.current.recording[index] ?? 0,
        ),
      );

      setOutputSpectrum(mergedSpectrum);
      setOutputSpectrumPeaks((currentPeaks) =>
        updateFrequencyPeaks(currentPeaks, mergedSpectrum),
      );
    },
    [],
  );

  const clearOutputSlotSpectrum = useCallback(
    (slot: OutputSlot) => {
      setOutputSlotSpectrum(slot, []);
    },
    [setOutputSlotSpectrum],
  );

  const stopMusicOutputGraph = useCallback(() => {
    const activeGraph = musicOutputGraphRef.current;

    stopMusicProgressLoop();
    musicOutputGraphRef.current = null;
    setIsMusicOutputActive(false);

    if (activeGraph) {
      activeGraph.cancel();
      activeGraph.context.close().catch(() => undefined);
    }

    const outputAudio = musicPlaybackAudioRef.current;
    if (outputAudio) {
      outputAudio.pause();
      outputAudio.srcObject = null;
      outputAudio.removeAttribute('src');
      outputAudio.load();
    }

    clearOutputSlotLevel('music');
    clearOutputSlotSpectrum('music');
    setMusicPlayback((currentPlayback) => ({
      ...currentPlayback,
      isLoading: false,
      isPlaying: false,
      positionSeconds: 0,
    }));
  }, [clearOutputSlotLevel, clearOutputSlotSpectrum, stopMusicProgressLoop]);

  const stopRecordedPlaybackOutputGraph = useCallback(
    ({
      resetRecordedPosition = false,
    }: { resetRecordedPosition?: boolean } = {}) => {
      const activeGraph = recordedPlaybackOutputGraphRef.current;

      stopRecordedProgressLoop();
      recordedPlaybackOutputGraphRef.current = null;
      setIsRecordingPlaybackActive(false);

      if (activeGraph) {
        activeGraph.cancel();
        activeGraph.context.close().catch(() => undefined);
      }

      const outputAudio = recordedPlaybackAudioRef.current;
      if (outputAudio) {
        outputAudio.pause();
        outputAudio.srcObject = null;
        outputAudio.removeAttribute('src');
        outputAudio.load();
      }

      clearOutputSlotLevel('recording');
      clearOutputSlotSpectrum('recording');
      setRecordedPlayback((currentPlayback) => {
        const activeClipId = currentPlayback.activeClipId;

        if (!activeClipId) {
          return { ...currentPlayback, isPlaying: false };
        }

        const durationSeconds = activeGraph?.durationSeconds ?? 0;
        const currentPosition = activeGraph?.getCurrentTime
          ? clamp(activeGraph.getCurrentTime(), 0, durationSeconds)
          : (currentPlayback.positionsByClipId[activeClipId] ?? 0);

        return {
          ...currentPlayback,
          isPlaying: false,
          positionsByClipId: {
            ...currentPlayback.positionsByClipId,
            [activeClipId]: resetRecordedPosition ? 0 : currentPosition,
          },
        };
      });
    },
    [clearOutputSlotLevel, clearOutputSlotSpectrum, stopRecordedProgressLoop],
  );

  const stopPlaybackOutputGraph = useCallback(
    ({
      resetRecordedPosition = false,
    }: { resetRecordedPosition?: boolean } = {}) => {
      stopMusicOutputGraph();
      stopRecordedPlaybackOutputGraph({ resetRecordedPosition });
    },
    [stopMusicOutputGraph, stopRecordedPlaybackOutputGraph],
  );

  const stopMonitorOutputGraph = useCallback(() => {
    const activeGraph = monitorOutputGraphRef.current;

    monitorOutputGraphRef.current = null;
    setMonitorEnabled(false);

    if (activeGraph) {
      activeGraph.cancel();
      activeGraph.context.close().catch(() => undefined);
    }

    const outputAudio = monitorAudioRef.current;
    if (outputAudio) {
      outputAudio.pause();
      outputAudio.srcObject = null;
      outputAudio.removeAttribute('src');
      outputAudio.load();
    }

    clearOutputSlotLevel('monitor');
    clearOutputSlotSpectrum('monitor');
  }, [clearOutputSlotLevel, clearOutputSlotSpectrum]);

  const stopOutputGraph = useCallback(
    ({
      resetRecordedPosition = false,
    }: { resetRecordedPosition?: boolean } = {}) => {
      stopPlaybackOutputGraph({ resetRecordedPosition });
      stopMonitorOutputGraph();
    },
    [stopMonitorOutputGraph, stopPlaybackOutputGraph],
  );

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setIsSupported(false);
      setStatusMessage('Media device APIs are unavailable in this browser.');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextInputs = devices
        .filter((device) => device.kind === 'audioinput')
        .map(toAudioDevice);
      const nextOutputs = normalizeOutputs(
        devices
          .filter((device) => device.kind === 'audiooutput')
          .map(toAudioDevice),
      );

      setInputDevices(nextInputs);
      setOutputDevices(nextOutputs);
      setSelectedInputId((currentDeviceId) =>
        keepOrPickDevice(currentDeviceId, nextInputs),
      );
      setSelectedOutputId((currentDeviceId) =>
        keepOrPickOutput(currentDeviceId, nextOutputs),
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }, []);

  const startInputAnalyser = useCallback(
    async (stream: MediaStream) => {
      stopInputAnalyser();
      inputAnalyserRef.current = await createInputAnalyser(
        stream,
        setInputLevel,
        (nextSpectrum) => {
          setInputSpectrum(nextSpectrum);
          setInputSpectrumPeaks((currentPeaks) =>
            updateFrequencyPeaks(currentPeaks, nextSpectrum),
          );
        },
      );
    },
    [stopInputAnalyser],
  );

  const startInputStream = useCallback(
    async (deviceId?: string) => {
      if (appPaused || inputMuted) {
        throw new Error(
          inputMuted
            ? 'Unmute the microphone section before using input.'
            : 'Resume the app before using the microphone.',
        );
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is unavailable in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getAudioConstraints(
          deviceId,
          processingEnabled,
          processingSettings,
        ),
        video: false,
      });

      stopInputStream();
      inputStreamRef.current = stream;
      await startInputAnalyser(stream);
      setPermissionState('granted');
      setStatusMessage('Microphone active.');

      return stream;
    },
    [
      appPaused,
      inputMuted,
      processingEnabled,
      processingSettings,
      startInputAnalyser,
      stopInputStream,
    ],
  );

  const ensureInputStream = useCallback(async () => {
    if (inputStreamRef.current?.active) {
      return inputStreamRef.current;
    }

    return startInputStream(selectedInputId);
  }, [selectedInputId, startInputStream]);

  const handleRecordedClipReady = useCallback(
    (clip: RecordedClip) => {
      const inputName =
        selectedInputName || `Microphone ${inputDevices.length + 1}`;
      const clipId = `${Date.now()}-${Math.floor(Math.random() * 9999)}`;

      setRecordedClips((currentRecordings) => [
        ...currentRecordings,
        {
          ...clip,
          createdAt: Date.now(),
          id: clipId,
          inputDeviceId: selectedInputId,
          inputDeviceName: inputName,
          name: `${inputName} ${currentRecordings.length + 1}`,
        },
      ]);
      setRecordedPlayback((currentPlayback) => ({
        ...currentPlayback,
        positionsByClipId: {
          ...currentPlayback.positionsByClipId,
          [clipId]: 0,
        },
      }));
      setSelectedRecordingId(clipId);
    },
    [inputDevices.length, selectedInputId, selectedInputName],
  );

  const {
    isRecording,
    recordingSeconds,
    recordedClip,
    startRecording: startRecorder,
    stopRecording,
  } = useRecorder({
    ensureInputStream,
    setErrorMessage,
    setStatusMessage,
    onClipReady: handleRecordedClipReady,
  });

  const startRecording = useCallback(() => {
    if (appPaused || inputMuted) {
      setStatusMessage(
        inputMuted
          ? 'Unmute the microphone section before recording input.'
          : 'Resume the app before recording input.',
      );
      return;
    }

    void startRecorder();
  }, [appPaused, inputMuted, startRecorder]);

  const routeStreamToOutput = useCallback(
    async (
      outputAudio: HTMLAudioElement | null,
      stream: MediaStream,
    ): Promise<void> => {
      if (appPaused || outputMuted) {
        throw new Error(
          outputMuted
            ? 'Unmute the speaker section before playing audio.'
            : 'Resume the app before playing audio.',
        );
      }

      if (!outputAudio) {
        throw new Error('Output player is not ready.');
      }

      outputAudio.pause();
      outputAudio.srcObject = stream;
      outputAudio.volume = 1;

      await applySink(outputAudio, selectedOutputId);
      await outputAudio.play();
    },
    [appPaused, outputMuted, selectedOutputId],
  );

  const routePlaybackStreamToOutput = useCallback(
    (stream: MediaStream) =>
      routeStreamToOutput(musicPlaybackAudioRef.current, stream),
    [routeStreamToOutput],
  );

  const routeRecordedPlaybackStreamToOutput = useCallback(
    (stream: MediaStream) =>
      routeStreamToOutput(recordedPlaybackAudioRef.current, stream),
    [routeStreamToOutput],
  );

  const routeMonitorStreamToOutput = useCallback(
    (stream: MediaStream) =>
      routeStreamToOutput(monitorAudioRef.current, stream),
    [routeStreamToOutput],
  );

  const startSpeakerTest = useCallback(async () => {
    if (appPaused || outputMuted) {
      setStatusMessage(
        outputMuted
          ? 'Unmute the speaker section before playing audio.'
          : 'Resume the app before playing audio.',
      );
      return;
    }

    setErrorMessage('');
    stopMusicOutputGraph();

    try {
      if (speakerTestSettings.kind === 'music') {
        const startAtSeconds =
          pendingMusicStartAtRef.current ?? musicPlayback.positionSeconds;
        const musicSource = speakerTestSettings.musicSource;

        pendingMusicStartAtRef.current = null;

        if (musicSource === 'file' && !speakerTestSettings.musicFile) {
          setStatusMessage('Choose an audio file before playing.');
          return;
        }

        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          isLoading: true,
          isPlaying: false,
        }));
        musicOutputGraphRef.current = await createMusicOutputGraph({
          getArrayBuffer: async () => {
            if (musicSource === 'file') {
              return (
                speakerTestSettings.musicFile?.arrayBuffer() ??
                Promise.reject(
                  new Error('Choose an audio file before playing.'),
                )
              );
            }

            const selectedTrack = speakerMusicTracks[musicSource];
            const response = await fetch(selectedTrack.path);

            if (!response.ok) {
              throw new Error(`${selectedTrack.label} could not be loaded.`);
            }

            return response.arrayBuffer();
          },
          onEnded: stopMusicOutputGraph,
          routeStreamToOutput: routePlaybackStreamToOutput,
          setOutputLevel: (nextLevel) => setOutputSlotLevel('music', nextLevel),
          setOutputSpectrum: (nextSpectrum) =>
            setOutputSlotSpectrum('music', nextSpectrum),
          startAtSeconds,
        });
        setIsMusicOutputActive(true);
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          durationSeconds:
            musicOutputGraphRef.current?.durationSeconds ??
            currentPlayback.durationSeconds,
          isLoading: false,
          isPlaying: true,
          positionSeconds: clamp(
            startAtSeconds,
            0,
            musicOutputGraphRef.current?.durationSeconds ??
              currentPlayback.durationSeconds,
          ),
        }));
        startMusicProgressLoop();
      } else if (speakerTestSettings.kind === 'dialUp') {
        const startAtSeconds =
          pendingMusicStartAtRef.current ?? musicPlayback.positionSeconds;

        pendingMusicStartAtRef.current = null;
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          isLoading: true,
          isPlaying: false,
          marks: [],
        }));
        musicOutputGraphRef.current = await createMusicOutputGraph({
          getArrayBuffer: async () => {
            const response = await fetch(DIAL_UP_AUDIO_PATH);

            if (!response.ok) {
              throw new Error('Dial-up audio could not be loaded.');
            }

            return response.arrayBuffer();
          },
          onEnded: stopMusicOutputGraph,
          playbackGain: DIAL_UP_PLAYBACK_GAIN,
          routeStreamToOutput: routePlaybackStreamToOutput,
          setOutputLevel: (nextLevel) => setOutputSlotLevel('music', nextLevel),
          setOutputSpectrum: (nextSpectrum) =>
            setOutputSlotSpectrum('music', nextSpectrum),
          startAtSeconds,
        });
        setIsMusicOutputActive(true);
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          durationSeconds:
            musicOutputGraphRef.current?.durationSeconds ??
            currentPlayback.durationSeconds,
          isLoading: false,
          isPlaying: true,
          positionSeconds: clamp(
            startAtSeconds,
            0,
            musicOutputGraphRef.current?.durationSeconds ??
              currentPlayback.durationSeconds,
          ),
        }));
        startMusicProgressLoop();
      } else {
        musicOutputGraphRef.current = await createSpeakerTestOutputGraph({
          kind: speakerTestSettings.kind,
          routeStreamToOutput: routePlaybackStreamToOutput,
          setOutputLevel: (nextLevel) => setOutputSlotLevel('music', nextLevel),
          setOutputSpectrum: (nextSpectrum) =>
            setOutputSlotSpectrum('music', nextSpectrum),
          toneFrequency: speakerTestSettings.toneFrequency,
        });
        setIsMusicOutputActive(true);
      }

      setStatusMessage(
        speakerTestSettings.kind === 'music'
          ? `Playing music on ${selectedOutputName}.`
          : speakerTestSettings.kind === 'dialUp'
            ? `Playing dial-up tones on ${selectedOutputName}.`
            : `Playing test sound on ${selectedOutputName}.`,
      );
    } catch (error) {
      stopMusicOutputGraph();
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        isLoading: false,
      }));
      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    outputMuted,
    musicPlayback.positionSeconds,
    selectedOutputName,
    speakerTestSettings,
    startMusicProgressLoop,
    stopMusicOutputGraph,
    routePlaybackStreamToOutput,
    setOutputSlotLevel,
    setOutputSlotSpectrum,
  ]);

  const pauseMusicPlayback = useCallback(() => {
    const activeGraph = musicOutputGraphRef.current;

    if (!activeGraph?.pause) {
      return;
    }

    const positionSeconds =
      activeGraph.getCurrentTime?.() ?? musicPlayback.positionSeconds;

    activeGraph.pause();
    stopMusicProgressLoop();
    setMusicPlayback((currentPlayback) => ({
      ...currentPlayback,
      durationSeconds:
        activeGraph.durationSeconds ?? currentPlayback.durationSeconds,
      isLoading: false,
      isPlaying: false,
      positionSeconds,
    }));
    setStatusMessage(
      speakerTestSettings.kind === 'dialUp'
        ? 'Dial-up paused.'
        : 'Music paused.',
    );
  }, [
    musicPlayback.positionSeconds,
    speakerTestSettings.kind,
    stopMusicProgressLoop,
  ]);

  const resumeMusicPlayback = useCallback(() => {
    if (appPaused || outputMuted) {
      setStatusMessage(
        outputMuted
          ? 'Unmute the speaker section before playing audio.'
          : 'Resume the app before playing audio.',
      );
      return;
    }

    const activeGraph = musicOutputGraphRef.current;

    if (activeGraph?.playFrom) {
      activeGraph.playFrom(musicPlayback.positionSeconds);
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        isLoading: false,
        isPlaying: true,
      }));
      startMusicProgressLoop();
      setStatusMessage(
        speakerTestSettings.kind === 'dialUp'
          ? `Playing dial-up tones on ${selectedOutputName}.`
          : `Playing music on ${selectedOutputName}.`,
      );
      return;
    }

    pendingMusicStartAtRef.current = musicPlayback.positionSeconds;
    void startSpeakerTest();
  }, [
    appPaused,
    musicPlayback.positionSeconds,
    outputMuted,
    selectedOutputName,
    speakerTestSettings.kind,
    startMusicProgressLoop,
    startSpeakerTest,
  ]);

  const toggleMusicPlayback = useCallback(() => {
    if (musicPlayback.isLoading) {
      return;
    }

    if (musicPlayback.isPlaying) {
      pauseMusicPlayback();
      return;
    }

    resumeMusicPlayback();
  }, [
    musicPlayback.isLoading,
    musicPlayback.isPlaying,
    pauseMusicPlayback,
    resumeMusicPlayback,
  ]);

  const handleMusicSeek = useCallback(
    (positionSeconds: number) => {
      const activeGraph = musicOutputGraphRef.current;
      const durationSeconds =
        activeGraph?.durationSeconds ?? musicPlayback.durationSeconds;
      const nextPosition = clamp(positionSeconds, 0, durationSeconds || 0);
      const wasPlaying = activeGraph?.isPaused
        ? !activeGraph.isPaused()
        : false;

      if (activeGraph?.playFrom) {
        activeGraph.playFrom(nextPosition);

        if (wasPlaying) {
          startMusicProgressLoop();
        } else {
          activeGraph.pause?.();
          stopMusicProgressLoop();
        }
      }

      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds,
        isLoading: false,
        isPlaying: wasPlaying,
        positionSeconds: nextPosition,
      }));
    },
    [
      musicPlayback.durationSeconds,
      startMusicProgressLoop,
      stopMusicProgressLoop,
    ],
  );

  const markMusicPosition = useCallback(() => {
    const activeGraph = musicOutputGraphRef.current;
    const durationSeconds =
      activeGraph?.durationSeconds ?? musicPlayback.durationSeconds;

    if (durationSeconds <= 0) {
      return;
    }

    const positionSeconds = clamp(
      activeGraph?.getCurrentTime?.() ?? musicPlayback.positionSeconds,
      0,
      durationSeconds || 0,
    );
    const markId = `${Date.now()}-${Math.floor(Math.random() * 9999)}`;

    setMusicPlayback((currentPlayback) => ({
      ...currentPlayback,
      marks: [
        ...currentPlayback.marks,
        {
          id: markId,
          seconds: positionSeconds,
        },
      ],
      positionSeconds,
    }));
  }, [musicPlayback.durationSeconds, musicPlayback.positionSeconds]);

  const playMusicFromMark = useCallback(
    (markSeconds: number) => {
      const activeGraph = musicOutputGraphRef.current;
      const durationSeconds =
        activeGraph?.durationSeconds ?? musicPlayback.durationSeconds;
      const positionSeconds = clamp(markSeconds, 0, durationSeconds || 0);

      if (activeGraph?.playFrom) {
        activeGraph.playFrom(positionSeconds);
        startMusicProgressLoop();
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          isLoading: false,
          isPlaying: true,
          positionSeconds,
        }));
        setStatusMessage(`Playing music on ${selectedOutputName}.`);
        return;
      }

      pendingMusicStartAtRef.current = positionSeconds;
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        positionSeconds,
      }));
      void startSpeakerTest();
    },
    [
      musicPlayback.durationSeconds,
      selectedOutputName,
      startMusicProgressLoop,
      startSpeakerTest,
    ],
  );

  const deleteMusicMark = useCallback((markId: string) => {
    setMusicPlayback((currentPlayback) => ({
      ...currentPlayback,
      marks: currentPlayback.marks.filter((mark) => mark.id !== markId),
    }));
  }, []);

  const startMonitor = useCallback(async () => {
    if (appPaused || inputMuted || outputMuted) {
      setStatusMessage(
        inputMuted
          ? 'Unmute the microphone section before monitoring input.'
          : outputMuted
            ? 'Unmute the speaker section before monitoring input.'
            : 'Resume the app before monitoring input.',
      );
      return;
    }

    setErrorMessage('');
    stopMonitorOutputGraph();

    try {
      const stream = await ensureInputStream();
      monitorOutputGraphRef.current = await createMonitorOutputGraph({
        delayMs: monitorDelayMs,
        routeStreamToOutput: routeMonitorStreamToOutput,
        setOutputLevel: (nextLevel) => setOutputSlotLevel('monitor', nextLevel),
        setOutputSpectrum: (nextSpectrum) =>
          setOutputSlotSpectrum('monitor', nextSpectrum),
        stream,
      });

      setMonitorEnabled(true);
      setStatusMessage(
        monitorDelayMs === 0
          ? `Live monitor routed to ${selectedOutputName}.`
          : `Delayed monitor routed to ${selectedOutputName}.`,
      );
    } catch (error) {
      stopMonitorOutputGraph();
      setMonitorEnabled(false);
      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    inputMuted,
    ensureInputStream,
    monitorDelayMs,
    outputMuted,
    routeMonitorStreamToOutput,
    selectedOutputName,
    stopMonitorOutputGraph,
    setOutputSlotLevel,
    setOutputSlotSpectrum,
  ]);

  const stopMonitor = useCallback(() => {
    stopMonitorOutputGraph();
    setStatusMessage('Monitor stopped.');
  }, [stopMonitorOutputGraph]);

  const toggleInputMute = useCallback(() => {
    if (inputMuted) {
      setAppPaused(false);
      setInputMuted(false);
      setStatusMessage('Microphone section unmuted.');
      return;
    }

    stopRecording();
    if (monitorEnabled) {
      stopMonitorOutputGraph();
    }
    stopInputStream();
    setInputMuted(true);
    setStatusMessage('Microphone section muted. Input stopped.');
  }, [
    inputMuted,
    monitorEnabled,
    stopInputStream,
    stopMonitorOutputGraph,
    stopRecording,
  ]);

  const toggleOutputMute = useCallback(() => {
    if (outputMuted) {
      setAppPaused(false);
      setOutputMuted(false);
      setStatusMessage('Speaker section unmuted.');
      return;
    }

    setMonitorEnabled(false);
    stopOutputGraph();
    setOutputMuted(true);
    setStatusMessage('Speaker section muted. Output stopped.');
  }, [outputMuted, stopOutputGraph]);

  const pauseApp = useCallback(() => {
    stopRecording();
    setMonitorEnabled(false);
    stopOutputGraph();
    stopInputStream();
    setInputMuted(true);
    setOutputMuted(true);
    setAppPaused(true);
    setStatusMessage('App paused. Input and output are stopped.');
  }, [stopInputStream, stopOutputGraph, stopRecording]);

  const resumeApp = useCallback(() => {
    setInputMuted(false);
    setOutputMuted(false);
    setAppPaused(false);
    setStatusMessage('App resumed. Input and output are unmuted.');
  }, []);

  const toggleAllAudio = useCallback(() => {
    if (allAudioStopped) {
      resumeApp();
      return;
    }

    pauseApp();
  }, [allAudioStopped, pauseApp, resumeApp]);

  const playRecordedClip = useCallback(
    async (clipId?: string) => {
      const clip =
        clipId === undefined
          ? (selectedRecordedClip ?? recordedClips.at(-1))
          : (recordedClips.find((item) => item.id === clipId) ?? null);

      if (!clip) {
        return;
      }

      if (appPaused || outputMuted) {
        setStatusMessage(
          outputMuted
            ? 'Unmute the speaker section before playing audio.'
            : 'Resume the app before playing audio.',
        );
        return;
      }

      const startAtSeconds = clamp(
        recordedPlayback.positionsByClipId[clip.id] ?? 0,
        0,
        clip.durationSeconds,
      );

      setErrorMessage('');
      setSelectedRecordingId(clip.id);
      stopRecordedPlaybackOutputGraph();

      try {
        recordedPlaybackOutputGraphRef.current = await createClipOutputGraph({
          blob: clip.blob,
          onEnded: () =>
            stopRecordedPlaybackOutputGraph({
              resetRecordedPosition: true,
            }),
          routeStreamToOutput: routeRecordedPlaybackStreamToOutput,
          setOutputLevel: (nextLevel) =>
            setOutputSlotLevel('recording', nextLevel),
          setOutputSpectrum: (nextSpectrum) =>
            setOutputSlotSpectrum('recording', nextSpectrum),
          startAtSeconds,
        });
        setIsRecordingPlaybackActive(true);
        setRecordedPlayback((currentPlayback) => ({
          ...currentPlayback,
          activeClipId: clip.id,
          isPlaying: true,
          positionsByClipId: {
            ...currentPlayback.positionsByClipId,
            [clip.id]: clamp(
              startAtSeconds,
              0,
              recordedPlaybackOutputGraphRef.current?.durationSeconds ??
                clip.durationSeconds,
            ),
          },
        }));
        startRecordedProgressLoop(clip.id);
        setStatusMessage(`Playing recording on ${selectedOutputName}.`);
      } catch (error) {
        stopRecordedPlaybackOutputGraph();
        setErrorMessage(toErrorMessage(error));
      }
    },
    [
      appPaused,
      outputMuted,
      recordedClips,
      recordedPlayback.positionsByClipId,
      routeRecordedPlaybackStreamToOutput,
      selectedOutputName,
      selectedRecordedClip,
      startRecordedProgressLoop,
      setOutputSlotLevel,
      setOutputSlotSpectrum,
      stopRecordedPlaybackOutputGraph,
    ],
  );

  const pauseRecordedClip = useCallback(() => {
    const activeClipId = recordedPlayback.activeClipId;
    const activeGraph = recordedPlaybackOutputGraphRef.current;

    if (!activeClipId || !activeGraph?.pause) {
      return;
    }

    const durationSeconds = activeGraph.durationSeconds ?? 0;
    const positionSeconds = clamp(
      activeGraph.getCurrentTime?.() ??
        recordedPlayback.positionsByClipId[activeClipId] ??
        0,
      0,
      durationSeconds,
    );

    activeGraph.pause();
    stopRecordedProgressLoop();
    setRecordedPlayback((currentPlayback) => ({
      ...currentPlayback,
      isPlaying: false,
      positionsByClipId: {
        ...currentPlayback.positionsByClipId,
        [activeClipId]: positionSeconds,
      },
    }));
    setStatusMessage('Recording paused.');
  }, [
    recordedPlayback.activeClipId,
    recordedPlayback.positionsByClipId,
    stopRecordedProgressLoop,
  ]);

  const resumeRecordedClip = useCallback(
    (clipId: string) => {
      if (appPaused || outputMuted) {
        setStatusMessage(
          outputMuted
            ? 'Unmute the speaker section before playing audio.'
            : 'Resume the app before playing audio.',
        );
        return;
      }

      const activeGraph = recordedPlaybackOutputGraphRef.current;
      const positionSeconds = recordedPlayback.positionsByClipId[clipId] ?? 0;

      if (recordedPlayback.activeClipId === clipId && activeGraph?.playFrom) {
        activeGraph.playFrom(positionSeconds);
        setRecordedPlayback((currentPlayback) => ({
          ...currentPlayback,
          activeClipId: clipId,
          isPlaying: true,
        }));
        startRecordedProgressLoop(clipId);
        setStatusMessage(`Playing recording on ${selectedOutputName}.`);
        return;
      }

      void playRecordedClip(clipId);
    },
    [
      appPaused,
      outputMuted,
      playRecordedClip,
      recordedPlayback.activeClipId,
      recordedPlayback.positionsByClipId,
      selectedOutputName,
      startRecordedProgressLoop,
    ],
  );

  const toggleRecordedClipPlayback = useCallback(
    (clipId: string) => {
      if (
        recordedPlayback.activeClipId === clipId &&
        recordedPlayback.isPlaying
      ) {
        pauseRecordedClip();
        return;
      }

      resumeRecordedClip(clipId);
    },
    [
      pauseRecordedClip,
      recordedPlayback.activeClipId,
      recordedPlayback.isPlaying,
      resumeRecordedClip,
    ],
  );

  const handleRecordedClipSeek = useCallback(
    (clipId: string, positionSeconds: number) => {
      const clip = recordedClips.find((item) => item.id === clipId);

      if (!clip) {
        return;
      }

      const nextPosition = clamp(positionSeconds, 0, clip.durationSeconds);
      const isActiveClip =
        recordedPlayback.activeClipId === clipId &&
        recordedPlaybackOutputGraphRef.current !== null;
      const activeGraph = isActiveClip
        ? recordedPlaybackOutputGraphRef.current
        : null;
      const wasPlaying = activeGraph?.isPaused
        ? !activeGraph.isPaused()
        : isActiveClip && recordedPlayback.isPlaying;

      if (activeGraph?.playFrom) {
        activeGraph.playFrom(nextPosition);

        if (wasPlaying) {
          startRecordedProgressLoop(clipId);
        } else {
          activeGraph.pause?.();
          stopRecordedProgressLoop();
        }
      }

      setRecordedPlayback((currentPlayback) => ({
        ...currentPlayback,
        activeClipId: isActiveClip ? clipId : currentPlayback.activeClipId,
        isPlaying: isActiveClip ? wasPlaying : currentPlayback.isPlaying,
        positionsByClipId: {
          ...currentPlayback.positionsByClipId,
          [clipId]: nextPosition,
        },
      }));
    },
    [
      recordedClips,
      recordedPlayback.activeClipId,
      recordedPlayback.isPlaying,
      startRecordedProgressLoop,
      stopRecordedProgressLoop,
    ],
  );

  const renameRecordedClip = useCallback((clipId: string, nextName: string) => {
    setRecordedClips((currentClips) =>
      currentClips.map((clip) =>
        clip.id === clipId ? { ...clip, name: nextName } : clip,
      ),
    );
  }, []);

  const deleteRecordedClip = useCallback(
    (clipId: string) => {
      const clip = recordedClips.find((item) => item.id === clipId);

      if (!clip) {
        return;
      }

      if (recordedPlayback.activeClipId === clipId) {
        stopRecordedPlaybackOutputGraph({ resetRecordedPosition: true });
      }

      setRecordedClips((currentClips) =>
        currentClips.filter((currentClip) => currentClip.id !== clipId),
      );
      setRecordedPlayback((currentPlayback) => {
        const positionsByClipId = { ...currentPlayback.positionsByClipId };

        delete positionsByClipId[clipId];

        return {
          activeClipId:
            currentPlayback.activeClipId === clipId
              ? null
              : currentPlayback.activeClipId,
          isPlaying:
            currentPlayback.activeClipId === clipId
              ? false
              : currentPlayback.isPlaying,
          positionsByClipId,
        };
      });
      setSelectedRecordingId((currentClipId) =>
        currentClipId === clipId ? null : currentClipId,
      );
      revokeRecordedClipUrls([clip]);
      setStatusMessage('Recording deleted.');
    },
    [
      recordedClips,
      recordedPlayback.activeClipId,
      stopRecordedPlaybackOutputGraph,
    ],
  );

  const deleteAllRecordedClips = useCallback(() => {
    if (recordedClips.length === 0) {
      return;
    }

    stopRecordedPlaybackOutputGraph({ resetRecordedPosition: true });
    setRecordedClips((currentClips) => {
      revokeRecordedClipUrls(currentClips);

      return [];
    });
    setRecordedPlayback({
      activeClipId: null,
      isPlaying: false,
      positionsByClipId: {},
    });
    setSelectedRecordingId(null);
    setStatusMessage('All recordings deleted.');
  }, [recordedClips.length, stopRecordedPlaybackOutputGraph]);

  const selectRecordedClip = useCallback((clipId: string | null) => {
    setSelectedRecordingId(clipId);
  }, []);

  const syncPermissionState = useCallback(async () => {
    const permissionApi = navigator.permissions;

    if (!permissionApi?.query) {
      return;
    }

    try {
      const microphonePermission = await permissionApi.query({
        name: 'microphone' as PermissionName,
      });

      setPermissionState(
        microphonePermission.state === 'denied'
          ? 'blocked'
          : microphonePermission.state === 'granted'
            ? 'granted'
            : 'idle',
      );
    } catch {
      // Permissions API behavior differs across browsers.
    }
  }, []);

  const requestMicrophoneAccess = useCallback(async () => {
    if (appPaused || inputMuted) {
      setStatusMessage(
        inputMuted
          ? 'Unmute the microphone section before enabling input.'
          : 'Resume the app before enabling the microphone.',
      );
      return;
    }

    setErrorMessage('');

    try {
      await startInputStream(selectedInputId);
      await refreshDevices();
      void syncPermissionState();
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === 'NotAllowedError' ||
          error.name === 'SecurityError' ||
          error.message.includes('Permission denied'))
      ) {
        setPermissionState('blocked');
      }

      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    inputMuted,
    refreshDevices,
    syncPermissionState,
    selectedInputId,
    startInputStream,
  ]);

  const requestPermissionSync = useCallback(async () => {
    if (appPaused || inputMuted) {
      setStatusMessage(
        inputMuted
          ? 'Unmute the microphone section before re-requesting access.'
          : 'Resume the app before re-requesting access.',
      );
      return;
    }

    setErrorMessage('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is unavailable in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      stream.getTracks().forEach((track) => track.stop());
      await syncPermissionState();
      await refreshDevices();
      setStatusMessage('Permissions resynced and devices refreshed.');
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === 'NotAllowedError' ||
          error.name === 'SecurityError' ||
          error.message.includes('Permission denied'))
      ) {
        setPermissionState('blocked');
      }

      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    inputMuted,
    refreshDevices,
    setErrorMessage,
    setStatusMessage,
    syncPermissionState,
  ]);

  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;
    let isActive = true;
    const handlePermissionChange = () => {
      void syncPermissionState();
      void refreshDevices();
    };

    window.queueMicrotask(() => {
      void syncPermissionState().then(() => {
        if (!isActive || !navigator.permissions?.query) {
          return;
        }

        void navigator.permissions
          .query({ name: 'microphone' as PermissionName })
          .then((status) => {
            if (!isActive) {
              return;
            }

            permissionStatus = status;
            status.addEventListener?.('change', handlePermissionChange);
          })
          .catch(() => {
            // Not all browsers expose microphone permission descriptors.
          });
      });
    });

    return () => {
      isActive = false;

      if (permissionStatus) {
        permissionStatus.removeEventListener?.(
          'change',
          handlePermissionChange,
        );
      }
    };
  }, [refreshDevices, syncPermissionState]);

  const requestOutputAccess = useCallback(async () => {
    const mediaDevices = navigator.mediaDevices as MediaDevicesWithOutputPicker;

    if (!mediaDevices.selectAudioOutput) {
      setStatusMessage('Output picker is unavailable in this browser.');
      return;
    }

    setErrorMessage('');

    try {
      const device = await mediaDevices.selectAudioOutput();
      await refreshDevices();
      setSelectedOutputId(device.deviceId || DEFAULT_OUTPUT_ID);
      setStatusMessage('Output access updated.');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }, [refreshDevices]);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (monitorEnabled) {
        stopMonitorOutputGraph();
        setStatusMessage('Monitor stopped after input change.');
      }

      setSelectedInputId(event.target.value);
    },
    [monitorEnabled, stopMonitorOutputGraph],
  );

  const handleOutputChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setSelectedOutputId(event.target.value);
    },
    [],
  );

  const handleSpeakerTestKindChange = useCallback(
    (kind: SpeakerTestKind) => {
      if (musicOutputGraphRef.current?.mode === 'speakerTest') {
        stopMusicOutputGraph();
      }

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        kind,
      }));

      if (kind !== 'music' && kind !== 'dialUp') {
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          durationSeconds: 0,
          isLoading: false,
          isPlaying: false,
          positionSeconds: 0,
        }));
        return;
      }

      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isLoading: false,
        isPlaying: false,
        marks: kind === 'dialUp' ? [] : currentPlayback.marks,
        positionSeconds: 0,
      }));
    },
    [stopMusicOutputGraph],
  );

  const handleSpeakerToneFrequencyChange = useCallback((frequency: number) => {
    const nextFrequency = clamp(frequency, 40, 12000);
    const activeGraph = musicOutputGraphRef.current;

    setSpeakerTestSettings((currentSettings) => ({
      ...currentSettings,
      toneFrequency: nextFrequency,
    }));

    if (
      activeGraph?.mode === 'speakerTest' &&
      activeGraph.updateToneFrequency
    ) {
      activeGraph.updateToneFrequency(nextFrequency);
      return;
    }
  }, []);

  const handleSpeakerMusicSourceChange = useCallback(
    (musicSource: SpeakerMusicSource) => {
      if (musicOutputGraphRef.current?.mode === 'speakerTest') {
        stopMusicOutputGraph();
      }

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        musicSource,
      }));
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isLoading: false,
        isPlaying: false,
        marks: [],
        positionSeconds: 0,
      }));
    },
    [stopMusicOutputGraph],
  );

  const handleSpeakerMusicFileChange = useCallback(
    (musicFile: File | null) => {
      if (musicOutputGraphRef.current?.mode === 'speakerTest') {
        stopMusicOutputGraph();
      }

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        musicFile,
        musicSource: musicFile ? 'file' : currentSettings.musicSource,
      }));
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isLoading: false,
        isPlaying: false,
        marks: [],
        positionSeconds: 0,
      }));
    },
    [stopMusicOutputGraph],
  );

  const handleProcessingEnabledChange = useCallback(
    (enabled: boolean) => {
      if (monitorEnabled) {
        stopMonitorOutputGraph();
        setStatusMessage('Monitor stopped after processing change.');
      }

      setProcessingEnabled(enabled);
    },
    [monitorEnabled, stopMonitorOutputGraph],
  );

  const handleProcessingSettingChange = useCallback(
    (setting: ProcessingSettingKey, enabled: boolean) => {
      if (monitorEnabled) {
        stopMonitorOutputGraph();
        setStatusMessage('Monitor stopped after processing change.');
      }

      setProcessingSettings((currentSettings) => ({
        ...currentSettings,
        [setting]: enabled,
      }));
    },
    [monitorEnabled, stopMonitorOutputGraph],
  );

  const handleDelayChange = useCallback((nextDelayMs: number) => {
    const boundedDelay = clamp(nextDelayMs, 0, MAX_MONITOR_DELAY_MS);

    setMonitorDelayMs(boundedDelay);
    monitorOutputGraphRef.current?.updateDelay?.(boundedDelay / 1000);
  }, []);

  useEffect(() => {
    window.queueMicrotask(() => {
      setCanRouteOutput(
        typeof HTMLMediaElement !== 'undefined' &&
          'setSinkId' in HTMLMediaElement.prototype,
      );
      setCanRequestOutput(
        Boolean(
          navigator.mediaDevices &&
          'selectAudioOutput' in navigator.mediaDevices,
        ),
      );
      void refreshDevices();
    });

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);

      return () => {
        navigator.mediaDevices.removeEventListener(
          'devicechange',
          refreshDevices,
        );
      };
    }

    return undefined;
  }, [refreshDevices]);

  useEffect(() => {
    if (appPaused || inputMuted || permissionState === 'blocked') {
      return;
    }

    let cancelled = false;

    window.queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      startInputStream(selectedInputId)
        .then(() => {
          if (!cancelled) {
            void refreshDevices();
          }
        })
        .catch((error) => {
          if (!cancelled) {
            if (
              error instanceof DOMException &&
              (error.name === 'NotAllowedError' ||
                error.name === 'SecurityError' ||
                error.message.includes('Permission denied'))
            ) {
              setPermissionState('blocked');
            }

            setErrorMessage(toErrorMessage(error));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [
    appPaused,
    inputMuted,
    permissionState,
    processingEnabled,
    processingSettings,
    refreshDevices,
    selectedInputId,
    startInputStream,
  ]);

  useEffect(() => {
    window.queueMicrotask(() => {
      const outputAudioElements = [
        musicPlaybackAudioRef.current,
        recordedPlaybackAudioRef.current,
        monitorAudioRef.current,
      ].filter(Boolean);

      outputAudioElements.forEach((outputAudio) => {
        if (outputAudio) {
          applySink(outputAudio, selectedOutputId).catch((error) => {
            setErrorMessage(toErrorMessage(error));
          });
        }
      });
    });
  }, [selectedOutputId]);

  useEffect(() => {
    recordedClipsRef.current = recordedClips;
  }, [recordedClips]);

  useEffect(() => {
    let cancelled = false;

    void loadRecordedClipsFromStorage()
      .then((storedClips) => {
        if (cancelled) {
          revokeRecordedClipUrls(storedClips);
          return;
        }

        if (storedClips.length === 0) {
          return;
        }

        setRecordedClips((currentClips) =>
          mergeRecordedClips(storedClips, currentClips),
        );
        setRecordedPlayback((currentPlayback) => {
          const positionsByClipId = { ...currentPlayback.positionsByClipId };

          storedClips.forEach((clip) => {
            positionsByClipId[clip.id] ??= 0;
          });

          return {
            ...currentPlayback,
            positionsByClipId,
          };
        });
        setSelectedRecordingId(
          (currentClipId) => currentClipId ?? storedClips.at(-1)?.id ?? null,
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            `Saved recordings could not be loaded: ${toErrorMessage(error)}`,
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRecordedClipStorageReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isRecordedClipStorageReady) {
      return undefined;
    }

    const saveRequestId = recordedClipSaveRequestRef.current + 1;
    let cancelled = false;

    recordedClipSaveRequestRef.current = saveRequestId;

    void createRecordedClipStorageSnapshot(recordedClips)
      .then((snapshot) => {
        if (cancelled || recordedClipSaveRequestRef.current !== saveRequestId) {
          return;
        }

        writeRecordedClipStorageSnapshot(snapshot);
      })
      .catch((error) => {
        if (
          !cancelled &&
          recordedClipSaveRequestRef.current === saveRequestId
        ) {
          setErrorMessage(
            `Recordings could not be saved locally: ${toErrorMessage(error)}`,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isRecordedClipStorageReady, recordedClips]);

  useEffect(() => {
    return () => {
      stopOutputGraph();
      stopInputStream();
      revokeRecordedClipUrls(recordedClipsRef.current);
    };
  }, [stopInputStream, stopOutputGraph]);

  const controller = {
    isSupported,
    canRouteOutput,
    canRequestOutput,
    permissionState,
    inputDevices,
    outputDevices,
    selectedInputId,
    selectedOutputId,
    selectedInputName,
    selectedOutputName,
    appPaused,
    allAudioStopped,
    inputMuted,
    inputSignalState,
    outputMuted,
    outputSignalState,
    processingEnabled,
    processingSettings,
    speakerTestSettings,
    musicPlayback,
    monitorEnabled,
    monitorDelayMs,
    routedMode,
    inputLevel,
    outputLevel,
    inputSpectrum,
    outputSpectrum,
    inputSpectrumPeaks,
    outputSpectrumPeaks,
    inputStatus,
    outputStatus,
    isRecording,
    recordingSeconds,
    recordedClips,
    recordedClip,
    recordedPlayback,
    statusMessage,
    errorMessage,
    pauseApp,
    resumeApp,
    toggleAllAudio,
    toggleInputMute,
    toggleOutputMute,
    refreshDevices,
    startSpeakerTest,
    stopOutputGraph,
    pauseMusicPlayback,
    resumeMusicPlayback,
    toggleMusicPlayback,
    handleMusicSeek,
    markMusicPosition,
    playMusicFromMark,
    deleteMusicMark,
    startMonitor,
    stopMonitor,
    handleRecordedClipSeek,
    renameRecordedClip,
    deleteRecordedClip,
    deleteAllRecordedClips,
    selectRecordedClip,
    startRecording,
    stopRecording,
    playRecordedClip,
    toggleRecordedClipPlayback,
    requestMicrophoneAccess,
    requestPermissionSync,
    requestOutputAccess,
    handleInputChange,
    handleOutputChange,
    stopPlaybackOutput: stopMusicOutputGraph,
    stopRecordedPlaybackOutput: stopRecordedPlaybackOutputGraph,
    handleSpeakerMusicFileChange,
    handleSpeakerMusicSourceChange,
    handleSpeakerTestKindChange,
    handleSpeakerToneFrequencyChange,
    handleProcessingEnabledChange,
    handleProcessingSettingChange,
    handleDelayChange,
  };

  return {
    audioRef: musicPlaybackAudioRef,
    recordedPlaybackAudioRef,
    monitorAudioRef,
    controller,
  };
}

export type SoundCheckController = ReturnType<
  typeof useSoundCheck
>['controller'];
