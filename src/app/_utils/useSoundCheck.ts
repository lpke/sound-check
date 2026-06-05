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
  createToneOutputGraph,
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
  type ActiveInputAnalyser,
  type ActiveOutputGraph,
  type AudioDevice,
  type MediaDevicesWithOutputPicker,
  type PermissionState,
  type ProcessingSettingKey,
  type ProcessingSettings,
  type RoutedMode,
} from './types';
import { useRecorder } from './useRecorder';
import { clamp, toErrorMessage } from './utils';

const defaultProcessingSettings: ProcessingSettings = {
  autoGainControl: true,
  echoCancellation: true,
  noiseSuppression: true,
};

export function useSoundCheck() {
  const outputAudioRef = useRef<HTMLAudioElement | null>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const inputAnalyserRef = useRef<ActiveInputAnalyser | null>(null);
  const outputGraphRef = useRef<ActiveOutputGraph | null>(null);

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
  const [processingEnabled, setProcessingEnabled] = useState(false);
  const [processingSettings, setProcessingSettings] =
    useState<ProcessingSettings>(defaultProcessingSettings);
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [monitorDelayMs, setMonitorDelayMs] = useState(0);
  const [routedMode, setRoutedMode] = useState<RoutedMode>('idle');
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    'Enable microphone access to reveal device labels.',
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
    : getInputStatus(permissionState, inputLevel);
  const outputStatus = getOutputStatus(routedMode, outputLevel);

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
    setRoutedMode('idle');
  }, []);

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
      if (appPaused) {
        throw new Error('Resume the app before using the microphone.');
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
    if (appPaused) {
      setStatusMessage('Resume the app before recording input.');
      return;
    }

    void startRecorder();
  }, [appPaused, startRecorder]);

  const routeStreamToOutput = useCallback(
    async (stream: MediaStream) => {
      if (appPaused) {
        throw new Error('Resume the app before playing audio.');
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
    [appPaused, selectedOutputId],
  );

  const startToneTest = useCallback(async () => {
    if (appPaused) {
      setStatusMessage('Resume the app before playing audio.');
      return;
    }

    setErrorMessage('');
    setMonitorEnabled(false);
    stopOutputGraph();

    try {
      outputGraphRef.current = await createToneOutputGraph({
        onEnded: stopOutputGraph,
        routeStreamToOutput,
        setOutputLevel,
      });
      setRoutedMode('tone');
      setStatusMessage(`Playing test sound on ${selectedOutputName}.`);
    } catch (error) {
      stopOutputGraph();
      setErrorMessage(toErrorMessage(error));
    }
  }, [appPaused, routeStreamToOutput, selectedOutputName, stopOutputGraph]);

  const startMonitor = useCallback(async () => {
    if (appPaused) {
      setStatusMessage('Resume the app before monitoring input.');
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
    ensureInputStream,
    monitorDelayMs,
    routeStreamToOutput,
    selectedOutputName,
    stopOutputGraph,
  ]);

  const stopMonitor = useCallback(() => {
    setMonitorEnabled(false);
    stopOutputGraph();
    setStatusMessage('Monitor stopped.');
  }, [stopOutputGraph]);

  const pauseApp = useCallback(() => {
    stopRecording();
    setMonitorEnabled(false);
    stopOutputGraph();
    stopInputStream();
    setAppPaused(true);
    setStatusMessage('App paused. Input and output are stopped.');
  }, [stopInputStream, stopOutputGraph, stopRecording]);

  const resumeApp = useCallback(() => {
    setAppPaused(false);
    setStatusMessage('App resumed. Start a test when ready.');
  }, []);

  const playRecordedClip = useCallback(async () => {
    if (appPaused) {
      setStatusMessage('Resume the app before playing audio.');
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
    recordedClip,
    routeStreamToOutput,
    selectedOutputName,
    stopOutputGraph,
  ]);

  const requestMicrophoneAccess = useCallback(async () => {
    if (appPaused) {
      setStatusMessage('Resume the app before enabling the microphone.');
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
  }, [appPaused, refreshDevices, selectedInputId, startInputStream]);

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
    if (appPaused || permissionState !== 'granted') {
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
            setErrorMessage(toErrorMessage(error));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [
    appPaused,
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
    processingEnabled,
    processingSettings,
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
    refreshDevices,
    startToneTest,
    stopOutputGraph,
    startMonitor,
    stopMonitor,
    startRecording,
    stopRecording,
    playRecordedClip,
    requestMicrophoneAccess,
    requestOutputAccess,
    handleInputChange,
    handleOutputChange,
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
