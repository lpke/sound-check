import {
  HOT_THRESHOLD,
  VOICE_THRESHOLD,
  type AudioStatus,
  type PermissionState,
  type RoutedMode,
} from './types';

export function getInputStatus(
  permissionState: PermissionState,
  level: number,
): AudioStatus {
  if (permissionState !== 'granted') {
    return {
      label: 'Microphone is not active.',
      shortLabel: 'Off',
      tone: 'idle',
    };
  }

  if (level >= HOT_THRESHOLD) {
    return {
      label: 'Input is very loud.',
      shortLabel: 'Hot',
      tone: 'warn',
    };
  }

  if (level >= VOICE_THRESHOLD) {
    return {
      label: 'Voice activity detected.',
      shortLabel: 'Talking',
      tone: 'good',
    };
  }

  return {
    label: 'Waiting for input.',
    shortLabel: 'Quiet',
    tone: 'idle',
  };
}

export function getOutputStatus(
  routedMode: RoutedMode,
  level: number,
): AudioStatus {
  if (routedMode === 'idle') {
    return {
      label: 'No audio is playing.',
      shortLabel: 'Idle',
      tone: 'idle',
    };
  }

  if (level >= HOT_THRESHOLD) {
    return {
      label: 'Output signal is strong.',
      shortLabel: 'Hot',
      tone: 'warn',
    };
  }

  return {
    label:
      routedMode === 'monitor'
        ? 'Monitoring microphone output.'
        : 'Audio is playing.',
    shortLabel: 'Playing',
    tone: 'good',
  };
}
