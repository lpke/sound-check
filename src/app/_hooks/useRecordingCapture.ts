import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  clampAudioBitrateKbps,
  DEFAULT_CALL_AUDIO_BITRATE_KBPS,
  encodeAudioBlobAtBitrate,
  isAbortError,
} from '@/utils/audioBitrate';
import { revokeRecordedClipUrls } from '@/utils/recordedClipStorage';
import {
  createClipId,
  type RecordedPlaybackState,
} from '@/utils/soundCheckState';
import type {
  AudioDevice,
  NamedRecordedClip,
  RecordedClip,
} from '@/utils/types';
import { toErrorMessage } from '@/utils/utils';
import { useRecorder } from '@/hooks/useRecorder';

type UseRecordingCaptureOptions = {
  appPaused: boolean;
  ensureInputStream: () => Promise<MediaStream>;
  inputDevices: AudioDevice[];
  inputMuted: boolean;
  selectedInputId: string;
  selectedInputName: string;
  setErrorMessage: (message: string) => void;
  setRecordedClips: Dispatch<SetStateAction<NamedRecordedClip[]>>;
  setRecordedPlayback: Dispatch<SetStateAction<RecordedPlaybackState>>;
  setSelectedRecordingId: Dispatch<SetStateAction<string | null>>;
  setStatusMessage: (message: string) => void;
};

export function useRecordingCapture({
  appPaused,
  ensureInputStream,
  inputDevices,
  inputMuted,
  selectedInputId,
  selectedInputName,
  setErrorMessage,
  setRecordedClips,
  setRecordedPlayback,
  setSelectedRecordingId,
  setStatusMessage,
}: UseRecordingCaptureOptions) {
  const [saveRecordingWithCustomBitrate, setSaveRecordingWithCustomBitrate] =
    useState(false);
  const [recordingBitrateKbps, setRecordingBitrateKbps] = useState(
    DEFAULT_CALL_AUDIO_BITRATE_KBPS,
  );
  const [
    encodingRecordedClipProgressById,
    setEncodingRecordedClipProgressById,
  ] = useState<Record<string, number>>({});
  const encodingAbortControllersRef = useRef<Map<string, AbortController>>(
    new Map(),
  );

  const setEncodingProgress = useCallback(
    (clipId: string, progressPercent: number | null) => {
      setEncodingRecordedClipProgressById((currentProgress) => {
        const nextProgress = { ...currentProgress };

        if (progressPercent === null) {
          delete nextProgress[clipId];
          return nextProgress;
        }

        nextProgress[clipId] = progressPercent;

        return nextProgress;
      });
    },
    [],
  );

  const handleRecordedClipReady = useCallback(
    (clip: RecordedClip) => {
      const inputName =
        selectedInputName || `Microphone ${inputDevices.length + 1}`;
      const clipId = createClipId();
      const createdAt = Date.now();

      setRecordedClips((currentRecordings) => [
        ...currentRecordings,
        {
          ...clip,
          createdAt,
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

      if (!saveRecordingWithCustomBitrate) {
        return undefined;
      }

      const originalAverageBitrateKbps =
        clip.originalAverageBitrateKbps ?? clip.averageBitrateKbps;
      const targetBitrateKbps = clampAudioBitrateKbps(recordingBitrateKbps);
      const abortController = new AbortController();

      encodingAbortControllersRef.current.set(clipId, abortController);
      setEncodingProgress(clipId, 0);
      setStatusMessage(`Encoding recording at ${targetBitrateKbps} kbps.`);

      void encodeAudioBlobAtBitrate({
        bitrateKbps: targetBitrateKbps,
        blob: clip.blob,
        durationSeconds: clip.durationSeconds,
        onProgress: (progressPercent) =>
          setEncodingProgress(clipId, progressPercent),
        signal: abortController.signal,
      })
        .then((encodedClip) => {
          setRecordedClips((currentClips) => {
            const clipIndex = currentClips.findIndex(
              (currentClip) => currentClip.id === clipId,
            );

            if (clipIndex === -1) {
              revokeRecordedClipUrls([encodedClip]);
              return currentClips;
            }

            return currentClips.map((currentClip) => {
              if (currentClip.id !== clipId) {
                return currentClip;
              }

              revokeRecordedClipUrls([currentClip]);

              return {
                ...currentClip,
                averageBitrateKbps: encodedClip.averageBitrateKbps,
                bitrateModified: true,
                blob: encodedClip.blob,
                durationSeconds: encodedClip.durationSeconds,
                mimeType: encodedClip.mimeType,
                originalAverageBitrateKbps,
                targetBitrateKbps,
                url: encodedClip.url,
              };
            });
          });

          setStatusMessage(`Recording saved at ${targetBitrateKbps} kbps.`);
        })
        .catch((error) => {
          if (isAbortError(error)) {
            return;
          }

          setErrorMessage(
            `Recording bitrate encode failed: ${toErrorMessage(error)}`,
          );
        })
        .finally(() => {
          encodingAbortControllersRef.current.delete(clipId);
          setEncodingProgress(clipId, null);
        });

      return false;
    },
    [
      inputDevices.length,
      recordingBitrateKbps,
      saveRecordingWithCustomBitrate,
      selectedInputId,
      selectedInputName,
      setEncodingProgress,
      setErrorMessage,
      setRecordedClips,
      setRecordedPlayback,
      setSelectedRecordingId,
      setStatusMessage,
    ],
  );

  const {
    isRecording,
    recordingSeconds,
    recordedClip,
    startRecording: startRecorder,
    stopRecording,
  } = useRecorder({
    ensureInputStream,
    onClipReady: handleRecordedClipReady,
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
  }, [appPaused, inputMuted, setStatusMessage, startRecorder]);

  const handleSaveRecordingWithCustomBitrateChange = useCallback(
    (enabled: boolean) => {
      setSaveRecordingWithCustomBitrate(enabled);
    },
    [],
  );

  const handleRecordingBitrateChange = useCallback((bitrateKbps: number) => {
    setRecordingBitrateKbps(clampAudioBitrateKbps(bitrateKbps));
  }, []);

  const cancelRecordingBitrateEncode = useCallback(
    (clipId: string) => {
      const abortController = encodingAbortControllersRef.current.get(clipId);

      if (!abortController) {
        return;
      }

      abortController.abort();
      encodingAbortControllersRef.current.delete(clipId);
      setEncodingProgress(clipId, null);
    },
    [setEncodingProgress],
  );

  const cancelAllRecordingBitrateEncodes = useCallback(() => {
    encodingAbortControllersRef.current.forEach((abortController) => {
      abortController.abort();
    });
    encodingAbortControllersRef.current.clear();
    setEncodingRecordedClipProgressById({});
  }, []);

  useEffect(() => {
    const encodingAbortControllers = encodingAbortControllersRef.current;

    return () => {
      encodingAbortControllers.forEach((abortController) => {
        abortController.abort();
      });
      encodingAbortControllers.clear();
    };
  }, []);

  return {
    cancelAllRecordingBitrateEncodes,
    cancelRecordingBitrateEncode,
    encodingRecordedClipProgressById,
    handleRecordingBitrateChange,
    handleSaveRecordingWithCustomBitrateChange,
    isRecording,
    recordedClip,
    recordingSeconds,
    recordingBitrateKbps,
    saveRecordingWithCustomBitrate,
    startRecording,
    stopRecording,
  };
}
