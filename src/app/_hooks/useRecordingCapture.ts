import { type Dispatch, type SetStateAction, useCallback } from 'react';
import {
  createClipId,
  type RecordedPlaybackState,
} from '@/utils/soundCheckState';
import type {
  AudioDevice,
  NamedRecordedClip,
  RecordedClip,
} from '@/utils/types';
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
  const handleRecordedClipReady = useCallback(
    (clip: RecordedClip) => {
      const inputName =
        selectedInputName || `Microphone ${inputDevices.length + 1}`;
      const clipId = createClipId();

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
    [
      inputDevices.length,
      selectedInputId,
      selectedInputName,
      setRecordedClips,
      setRecordedPlayback,
      setSelectedRecordingId,
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

  return {
    isRecording,
    recordedClip,
    recordingSeconds,
    startRecording,
    stopRecording,
  };
}
