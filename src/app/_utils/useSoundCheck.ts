'use client';

import {
  type ChangeEvent,
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
import { getInputStatus, getOutputStatus } from './status';
import {
  DEFAULT_OUTPUT_ID,
  MAX_MONITOR_DELAY_MS,
  SIGNAL_THRESHOLD,
  type ActiveInputAnalyser,
  type ActiveOutputGraph,
  type AudioDevice,
  type MediaDevicesWithOutputPicker,
  type PermissionState,
  type ProcessingSettingKey,
  type ProcessingSettings,
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
  musicSource: 'builtIn',
  toneFrequency: 440,
};

type MusicPlaybackState = {
  durationSeconds: number;
  isPlaying: boolean;
  markSeconds: number | null;
  positionSeconds: number;
};

export function useSoundCheck() {
  const outputAudioRef = useRef<HTMLAudioElement | null>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const inputAnalyserRef = useRef<ActiveInputAnalyser | null>(null);
  const outputGraphRef = useRef<ActiveOutputGraph | null>(null);
  const musicProgressTimerRef = useRef<number | null>(null);
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
  const [processingEnabled, setProcessingEnabled] = useState(false);
  const [processingSettings, setProcessingSettings] =
    useState<ProcessingSettings>(defaultProcessingSettings);
  const [speakerTestSettings, setSpeakerTestSettings] =
    useState<SpeakerTestSettings>(defaultSpeakerTestSettings);
  const [musicPlayback, setMusicPlayback] = useState<MusicPlaybackState>({
    durationSeconds: 0,
    isPlaying: false,
    markSeconds: null,
    positionSeconds: 0,
  });
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [monitorDelayMs, setMonitorDelayMs] = useState(0);
  const [routedMode, setRoutedMode] = useState<RoutedMode>('idle');
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
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
      const activeGraph = outputGraphRef.current;

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

  const stopInputAnalyser = useCallback(() => {
    const activeAnalyser = inputAnalyserRef.current;
    if (!activeAnalyser) {
      setInputLevel(0);
      return;
    }

    inputAnalyserRef.current = null;
    activeAnalyser.cancel();
    activeAnalyser.context.close().catch(() => undefined);
    setInputLevel(0);
  }, []);

  const stopInputStream = useCallback(() => {
    stopInputAnalyser();

    inputStreamRef.current?.getTracks().forEach((track) => track.stop());
    inputStreamRef.current = null;
    setPermissionState('idle');
  }, [stopInputAnalyser]);

  const stopOutputGraph = useCallback(() => {
    const activeGraph = outputGraphRef.current;

    stopMusicProgressLoop();
    outputGraphRef.current = null;

    if (activeGraph) {
      activeGraph.cancel();
      activeGraph.context.close().catch(() => undefined);
    }

    const outputAudio = outputAudioRef.current;
    if (outputAudio) {
      outputAudio.pause();
      outputAudio.srcObject = null;
      outputAudio.removeAttribute('src');
      outputAudio.load();
    }

    setOutputLevel(0);
    setMusicPlayback((currentPlayback) => ({
      ...currentPlayback,
      isPlaying: false,
      positionSeconds: 0,
    }));
    setRoutedMode('idle');
  }, [stopMusicProgressLoop]);

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
    async (stream: MediaStream) => {
      if (appPaused || outputMuted) {
        throw new Error(
          outputMuted
            ? 'Unmute the speaker section before playing audio.'
            : 'Resume the app before playing audio.',
        );
      }

      const outputAudio = outputAudioRef.current;

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
    setMonitorEnabled(false);
    stopOutputGraph();

    try {
      if (speakerTestSettings.kind === 'music') {
        const startAtSeconds =
          pendingMusicStartAtRef.current ?? musicPlayback.positionSeconds;

        pendingMusicStartAtRef.current = null;

        if (
          speakerTestSettings.musicSource === 'file' &&
          !speakerTestSettings.musicFile
        ) {
          setStatusMessage('Choose an audio file before playing.');
          return;
        }

        outputGraphRef.current = await createMusicOutputGraph({
          getArrayBuffer: async () => {
            if (speakerTestSettings.musicSource === 'file') {
              return (
                speakerTestSettings.musicFile?.arrayBuffer() ??
                Promise.reject(
                  new Error('Choose an audio file before playing.'),
                )
              );
            }

            const response = await fetch('/audio/blinding-lights.flac');

            if (!response.ok) {
              throw new Error('Built-in audio file could not be loaded.');
            }

            return response.arrayBuffer();
          },
          onEnded: stopOutputGraph,
          routeStreamToOutput,
          setOutputLevel,
          startAtSeconds,
        });
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          durationSeconds:
            outputGraphRef.current?.durationSeconds ??
            currentPlayback.durationSeconds,
          isPlaying: true,
          positionSeconds: clamp(
            startAtSeconds,
            0,
            outputGraphRef.current?.durationSeconds ??
              currentPlayback.durationSeconds,
          ),
        }));
        startMusicProgressLoop();
      } else {
        outputGraphRef.current = await createSpeakerTestOutputGraph({
          kind: speakerTestSettings.kind,
          onEnded: stopOutputGraph,
          routeStreamToOutput,
          setOutputLevel,
          toneFrequency: speakerTestSettings.toneFrequency,
        });
      }

      setRoutedMode('speakerTest');
      setStatusMessage(
        speakerTestSettings.kind === 'music'
          ? `Playing music on ${selectedOutputName}.`
          : `Playing test sound on ${selectedOutputName}.`,
      );
    } catch (error) {
      stopOutputGraph();
      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    outputMuted,
    musicPlayback.positionSeconds,
    routeStreamToOutput,
    selectedOutputName,
    speakerTestSettings,
    startMusicProgressLoop,
    stopOutputGraph,
  ]);

  const pauseMusicPlayback = useCallback(() => {
    const activeGraph = outputGraphRef.current;

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
      isPlaying: false,
      positionSeconds,
    }));
    setStatusMessage('Music paused.');
  }, [musicPlayback.positionSeconds, stopMusicProgressLoop]);

  const resumeMusicPlayback = useCallback(() => {
    if (appPaused || outputMuted) {
      setStatusMessage(
        outputMuted
          ? 'Unmute the speaker section before playing audio.'
          : 'Resume the app before playing audio.',
      );
      return;
    }

    const activeGraph = outputGraphRef.current;

    if (activeGraph?.playFrom) {
      activeGraph.playFrom(musicPlayback.positionSeconds);
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        isPlaying: true,
      }));
      startMusicProgressLoop();
      setStatusMessage(`Playing music on ${selectedOutputName}.`);
      return;
    }

    pendingMusicStartAtRef.current = musicPlayback.positionSeconds;
    void startSpeakerTest();
  }, [
    appPaused,
    musicPlayback.positionSeconds,
    outputMuted,
    selectedOutputName,
    startMusicProgressLoop,
    startSpeakerTest,
  ]);

  const toggleMusicPlayback = useCallback(() => {
    if (musicPlayback.isPlaying) {
      pauseMusicPlayback();
      return;
    }

    resumeMusicPlayback();
  }, [musicPlayback.isPlaying, pauseMusicPlayback, resumeMusicPlayback]);

  const handleMusicSeek = useCallback(
    (positionSeconds: number) => {
      const activeGraph = outputGraphRef.current;
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
    const activeGraph = outputGraphRef.current;
    const durationSeconds =
      activeGraph?.durationSeconds ?? musicPlayback.durationSeconds;
    const positionSeconds = clamp(
      activeGraph?.getCurrentTime?.() ?? musicPlayback.positionSeconds,
      0,
      durationSeconds || 0,
    );

    setMusicPlayback((currentPlayback) => ({
      ...currentPlayback,
      markSeconds: positionSeconds,
      positionSeconds,
    }));
  }, [musicPlayback.durationSeconds, musicPlayback.positionSeconds]);

  const playMusicFromMark = useCallback(() => {
    if (musicPlayback.markSeconds === null) {
      return;
    }

    const activeGraph = outputGraphRef.current;

    if (activeGraph?.playFrom) {
      activeGraph.playFrom(musicPlayback.markSeconds);
      startMusicProgressLoop();
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        isPlaying: true,
        positionSeconds: musicPlayback.markSeconds ?? 0,
      }));
      setStatusMessage(`Playing music on ${selectedOutputName}.`);
      return;
    }

    pendingMusicStartAtRef.current = musicPlayback.markSeconds;
    setMusicPlayback((currentPlayback) => ({
      ...currentPlayback,
      positionSeconds: musicPlayback.markSeconds ?? 0,
    }));
    void startSpeakerTest();
  }, [
    musicPlayback.markSeconds,
    selectedOutputName,
    startMusicProgressLoop,
    startSpeakerTest,
  ]);

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
    stopOutputGraph();

    try {
      const stream = await ensureInputStream();
      outputGraphRef.current = await createMonitorOutputGraph({
        delayMs: monitorDelayMs,
        routeStreamToOutput,
        setOutputLevel,
        stream,
      });

      setMonitorEnabled(true);
      setRoutedMode('monitor');
      setStatusMessage(
        monitorDelayMs === 0
          ? `Live monitor routed to ${selectedOutputName}.`
          : `Delayed monitor routed to ${selectedOutputName}.`,
      );
    } catch (error) {
      stopOutputGraph();
      setMonitorEnabled(false);
      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    inputMuted,
    ensureInputStream,
    monitorDelayMs,
    outputMuted,
    routeStreamToOutput,
    selectedOutputName,
    stopOutputGraph,
  ]);

  const stopMonitor = useCallback(() => {
    setMonitorEnabled(false);
    stopOutputGraph();
    setStatusMessage('Monitor stopped.');
  }, [stopOutputGraph]);

  const toggleInputMute = useCallback(() => {
    if (inputMuted) {
      setAppPaused(false);
      setInputMuted(false);
      setStatusMessage('Microphone section unmuted.');
      return;
    }

    stopRecording();
    setMonitorEnabled(false);
    if (routedMode === 'monitor') {
      stopOutputGraph();
    }
    stopInputStream();
    setInputMuted(true);
    setStatusMessage('Microphone section muted. Input stopped.');
  }, [inputMuted, routedMode, stopInputStream, stopOutputGraph, stopRecording]);

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

  const playRecordedClip = useCallback(async () => {
    if (appPaused || outputMuted) {
      setStatusMessage(
        outputMuted
          ? 'Unmute the speaker section before playing audio.'
          : 'Resume the app before playing audio.',
      );
      return;
    }

    if (!recordedClip) {
      return;
    }

    setErrorMessage('');
    setMonitorEnabled(false);
    stopOutputGraph();

    try {
      outputGraphRef.current = await createClipOutputGraph({
        blob: recordedClip.blob,
        onEnded: stopOutputGraph,
        routeStreamToOutput,
        setOutputLevel,
      });
      setRoutedMode('clip');
      setStatusMessage(`Playing recording on ${selectedOutputName}.`);
    } catch (error) {
      stopOutputGraph();
      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    outputMuted,
    recordedClip,
    routeStreamToOutput,
    selectedOutputName,
    stopOutputGraph,
  ]);

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
    } catch (error) {
      setPermissionState('blocked');
      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    inputMuted,
    refreshDevices,
    selectedInputId,
    startInputStream,
  ]);

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
        setMonitorEnabled(false);
        stopOutputGraph();
        setStatusMessage('Monitor stopped after input change.');
      }

      setSelectedInputId(event.target.value);
    },
    [monitorEnabled, stopOutputGraph],
  );

  const handleOutputChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setSelectedOutputId(event.target.value);
    },
    [],
  );

  const handleSpeakerTestKindChange = useCallback(
    (kind: SpeakerTestKind) => {
      if (routedMode === 'speakerTest') {
        stopOutputGraph();
      }

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        kind,
      }));

      if (kind !== 'music') {
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          isPlaying: false,
          positionSeconds: 0,
        }));
      }
    },
    [routedMode, stopOutputGraph],
  );

  const handleSpeakerToneFrequencyChange = useCallback((frequency: number) => {
    setSpeakerTestSettings((currentSettings) => ({
      ...currentSettings,
      toneFrequency: clamp(frequency, 40, 12000),
    }));
  }, []);

  const handleSpeakerMusicSourceChange = useCallback(
    (musicSource: SpeakerMusicSource) => {
      if (routedMode === 'speakerTest') {
        stopOutputGraph();
      }

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        musicSource,
      }));
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isPlaying: false,
        markSeconds: null,
        positionSeconds: 0,
      }));
    },
    [routedMode, stopOutputGraph],
  );

  const handleSpeakerMusicFileChange = useCallback(
    (musicFile: File | null) => {
      if (routedMode === 'speakerTest') {
        stopOutputGraph();
      }

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        musicFile,
        musicSource: musicFile ? 'file' : currentSettings.musicSource,
      }));
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isPlaying: false,
        markSeconds: null,
        positionSeconds: 0,
      }));
    },
    [routedMode, stopOutputGraph],
  );

  const handleProcessingEnabledChange = useCallback(
    (enabled: boolean) => {
      if (monitorEnabled) {
        setMonitorEnabled(false);
        stopOutputGraph();
        setStatusMessage('Monitor stopped after processing change.');
      }

      setProcessingEnabled(enabled);
    },
    [monitorEnabled, stopOutputGraph],
  );

  const handleProcessingSettingChange = useCallback(
    (setting: ProcessingSettingKey, enabled: boolean) => {
      if (monitorEnabled) {
        setMonitorEnabled(false);
        stopOutputGraph();
        setStatusMessage('Monitor stopped after processing change.');
      }

      setProcessingSettings((currentSettings) => ({
        ...currentSettings,
        [setting]: enabled,
      }));
    },
    [monitorEnabled, stopOutputGraph],
  );

  const handleDelayChange = useCallback((nextDelayMs: number) => {
    const boundedDelay = clamp(nextDelayMs, 0, MAX_MONITOR_DELAY_MS);

    setMonitorDelayMs(boundedDelay);
    outputGraphRef.current?.updateDelay?.(boundedDelay / 1000);
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
            setPermissionState('blocked');
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
    const outputAudio = outputAudioRef.current;

    if (!outputAudio || routedMode === 'idle') {
      return;
    }

    applySink(outputAudio, selectedOutputId).catch((error) => {
      setErrorMessage(toErrorMessage(error));
    });
  }, [routedMode, selectedOutputId]);

  useEffect(() => {
    return () => {
      stopOutputGraph();
      stopInputStream();
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
    inputStatus,
    outputStatus,
    isRecording,
    recordingSeconds,
    recordedClip,
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
    startMonitor,
    stopMonitor,
    startRecording,
    stopRecording,
    playRecordedClip,
    requestMicrophoneAccess,
    requestOutputAccess,
    handleInputChange,
    handleOutputChange,
    handleSpeakerMusicFileChange,
    handleSpeakerMusicSourceChange,
    handleSpeakerTestKindChange,
    handleSpeakerToneFrequencyChange,
    handleProcessingEnabledChange,
    handleProcessingSettingChange,
    handleDelayChange,
  };

  return {
    audioRef: outputAudioRef,
    controller,
  };
}

export type SoundCheckController = ReturnType<
  typeof useSoundCheck
>['controller'];
