import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from 'react';

type UseAppAudioControlsOptions = {
  monitorEnabled: boolean;
  resetOutputForDeviceWarning: (options?: { resumeMonitor?: boolean }) => void;
  setStatusMessage: (message: string) => void;
  shouldResetOutputForDeviceWarning: boolean;
  stopInputStream: () => void;
  stopMonitorOutputGraph: () => void;
  stopOutputGraph: (options?: {
    preserveMusicPosition?: boolean;
    resetRecordedPosition?: boolean;
  }) => void;
  stopRecording: () => void;
};

type AppAudioState = {
  appPaused: boolean;
  inputMuted: boolean;
  outputMuted: boolean;
  setAppPaused: Dispatch<SetStateAction<boolean>>;
  setInputMuted: Dispatch<SetStateAction<boolean>>;
  setOutputMuted: Dispatch<SetStateAction<boolean>>;
};

export function useAppAudioState(): AppAudioState {
  const [appPaused, setAppPaused] = useState(false);
  const [inputMuted, setInputMuted] = useState(false);
  const [outputMuted, setOutputMuted] = useState(false);

  return {
    appPaused,
    inputMuted,
    outputMuted,
    setAppPaused,
    setInputMuted,
    setOutputMuted,
  };
}

export function useAppAudioControls(
  {
    appPaused,
    inputMuted,
    outputMuted,
    setAppPaused,
    setInputMuted,
    setOutputMuted,
  }: AppAudioState,
  {
    monitorEnabled,
    resetOutputForDeviceWarning,
    setStatusMessage,
    shouldResetOutputForDeviceWarning,
    stopInputStream,
    stopMonitorOutputGraph,
    stopOutputGraph,
    stopRecording,
  }: UseAppAudioControlsOptions,
) {
  const allAudioStopped = appPaused || (inputMuted && outputMuted);

  const toggleInputMute = useCallback(() => {
    if (inputMuted) {
      setAppPaused(false);
      setInputMuted(false);
      setStatusMessage('Microphone section unmuted.');
      return;
    }

    stopRecording();
    if (shouldResetOutputForDeviceWarning) {
      resetOutputForDeviceWarning({ resumeMonitor: false });
    } else if (monitorEnabled) {
      stopMonitorOutputGraph();
    }
    stopInputStream();
    setInputMuted(true);
    setStatusMessage('Microphone section muted. Input stopped.');
  }, [
    inputMuted,
    monitorEnabled,
    resetOutputForDeviceWarning,
    setAppPaused,
    setInputMuted,
    setStatusMessage,
    shouldResetOutputForDeviceWarning,
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

    stopOutputGraph({
      preserveMusicPosition: shouldResetOutputForDeviceWarning,
    });
    setOutputMuted(true);
    setStatusMessage('Speaker section muted. Output stopped.');
  }, [
    outputMuted,
    setAppPaused,
    setOutputMuted,
    setStatusMessage,
    shouldResetOutputForDeviceWarning,
    stopOutputGraph,
  ]);

  const pauseApp = useCallback(() => {
    stopRecording();
    stopOutputGraph();
    stopInputStream();
    setInputMuted(true);
    setOutputMuted(true);
    setAppPaused(true);
    setStatusMessage('App paused. Input and output are stopped.');
  }, [
    setAppPaused,
    setInputMuted,
    setOutputMuted,
    setStatusMessage,
    stopInputStream,
    stopOutputGraph,
    stopRecording,
  ]);

  const resumeApp = useCallback(() => {
    setInputMuted(false);
    setOutputMuted(false);
    setAppPaused(false);
    setStatusMessage('App resumed. Input and output are unmuted.');
  }, [setAppPaused, setInputMuted, setOutputMuted, setStatusMessage]);

  const toggleAllAudio = useCallback(() => {
    if (allAudioStopped) {
      resumeApp();
      return;
    }

    pauseApp();
  }, [allAudioStopped, pauseApp, resumeApp]);

  return {
    allAudioStopped,
    pauseApp,
    resumeApp,
    toggleAllAudio,
    toggleInputMute,
    toggleOutputMute,
  };
}
