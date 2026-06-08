import { getInputStatus, getOutputStatus } from '@/utils/status';
import {
  SIGNAL_THRESHOLD,
  type PermissionState,
  type RoutedMode,
  type SectionSignalState,
} from '@/utils/types';

type UseSoundCheckStatusOptions = {
  appPaused: boolean;
  inputLevel: number;
  inputMuted: boolean;
  isMusicOutputActive: boolean;
  isRecordingPlaybackActive: boolean;
  monitorEnabled: boolean;
  outputLevel: number;
  outputMuted: boolean;
  permissionState: PermissionState;
};

export function useSoundCheckStatus({
  appPaused,
  inputLevel,
  inputMuted,
  isMusicOutputActive,
  isRecordingPlaybackActive,
  monitorEnabled,
  outputLevel,
  outputMuted,
  permissionState,
}: UseSoundCheckStatusOptions) {
  const musicPlaybackMode = isMusicOutputActive ? 'speakerTest' : 'idle';
  const recordingPlaybackMode = isRecordingPlaybackActive ? 'clip' : 'idle';
  const activePlaybackMode: Exclude<RoutedMode, 'monitor'> =
    musicPlaybackMode === 'speakerTest' ? 'speakerTest' : recordingPlaybackMode;
  const routedMode: RoutedMode =
    activePlaybackMode === 'idle' && monitorEnabled
      ? 'monitor'
      : activePlaybackMode;

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

  return {
    inputSignalState,
    inputStatus,
    outputSignalState,
    outputStatus,
    routedMode,
  };
}
