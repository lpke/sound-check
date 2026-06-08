import { useCallback, useEffect, useRef, useState } from 'react';
import { createInputAnalyser } from '@/utils/audio';
import { getAudioConstraints } from '@/utils/devices';
import { isMicrophonePermissionError } from '@/utils/soundCheckErrors';
import { updateFrequencyPeaks } from '@/utils/soundCheckState';
import type {
  ActiveInputAnalyser,
  FrequencyLevels,
  PermissionState,
  ProcessingSettings,
} from '@/utils/types';
import { toErrorMessage } from '@/utils/utils';

type UseInputStreamOptions = {
  appPaused: boolean;
  inputMuted: boolean;
  processingEnabled: boolean;
  processingSettings: ProcessingSettings;
  refreshDevices: () => Promise<void>;
  selectedInputId: string;
  setErrorMessage: (message: string) => void;
  setStatusMessage: (message: string) => void;
};

export function useInputStream({
  appPaused,
  inputMuted,
  processingEnabled,
  processingSettings,
  refreshDevices,
  selectedInputId,
  setErrorMessage,
  setStatusMessage,
}: UseInputStreamOptions) {
  const inputStreamRef = useRef<MediaStream | null>(null);
  const inputAnalyserRef = useRef<ActiveInputAnalyser | null>(null);
  const [permissionState, setPermissionState] =
    useState<PermissionState>('idle');
  const [inputLevel, setInputLevel] = useState(0);
  const [inputSpectrum, setInputSpectrum] = useState<FrequencyLevels>([]);
  const [inputSpectrumPeaks, setInputSpectrumPeaks] = useState<FrequencyLevels>(
    [],
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
      setStatusMessage,
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
      if (isMicrophonePermissionError(error)) {
        setPermissionState('blocked');
      }

      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    inputMuted,
    refreshDevices,
    selectedInputId,
    setErrorMessage,
    setStatusMessage,
    startInputStream,
    syncPermissionState,
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
      if (isMicrophonePermissionError(error)) {
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
            if (isMicrophonePermissionError(error)) {
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
    setErrorMessage,
    startInputStream,
  ]);

  return {
    ensureInputStream,
    inputLevel,
    inputSpectrum,
    inputSpectrumPeaks,
    permissionState,
    requestMicrophoneAccess,
    requestPermissionSync,
    startInputStream,
    stopInputStream,
    syncPermissionState,
  };
}
