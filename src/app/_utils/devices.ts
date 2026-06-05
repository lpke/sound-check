import {
  DEFAULT_OUTPUT_ID,
  type AudioDevice,
  type ProcessingSettings,
  type SinkAudioElement,
} from './types';

export const fallbackOutputDevice: AudioDevice = {
  deviceId: DEFAULT_OUTPUT_ID,
  groupId: '',
  kind: 'audiooutput',
  label: 'System default',
};

export function normalizeOutputs(outputs: AudioDevice[]) {
  const seen = new Set<string>();

  return [fallbackOutputDevice, ...outputs].filter((device) => {
    const key = device.deviceId || DEFAULT_OUTPUT_ID;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function toAudioDevice(device: MediaDeviceInfo): AudioDevice {
  return {
    deviceId: device.deviceId,
    groupId: device.groupId,
    kind: device.kind,
    label: device.label,
  };
}

export function keepOrPickDevice(
  currentDeviceId: string,
  devices: AudioDevice[],
) {
  if (
    currentDeviceId &&
    devices.some((device) => device.deviceId === currentDeviceId)
  ) {
    return currentDeviceId;
  }

  return devices[0]?.deviceId ?? '';
}

export function keepOrPickOutput(
  currentDeviceId: string,
  devices: AudioDevice[],
) {
  if (
    currentDeviceId &&
    devices.some((device) => device.deviceId === currentDeviceId)
  ) {
    return currentDeviceId;
  }

  return devices[0]?.deviceId ?? DEFAULT_OUTPUT_ID;
}

export function getDeviceLabel(
  device: AudioDevice | undefined,
  devices: AudioDevice[],
  kind: MediaDeviceKind,
) {
  if (!device) {
    return kind === 'audioinput' ? 'No microphone selected' : 'System default';
  }

  if (device.label) {
    return device.label;
  }

  const index = devices.findIndex(
    (candidate) => candidate.deviceId === device.deviceId,
  );
  const ordinal = index >= 0 ? index + 1 : devices.length + 1;

  return kind === 'audioinput' ? `Microphone ${ordinal}` : `Speaker ${ordinal}`;
}

export function getAudioConstraints(
  deviceId: string | undefined,
  processingEnabled: boolean,
  processingSettings: ProcessingSettings,
): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    autoGainControl: processingEnabled && processingSettings.autoGainControl,
    echoCancellation: processingEnabled && processingSettings.echoCancellation,
    noiseSuppression: processingEnabled && processingSettings.noiseSuppression,
  };

  if (deviceId) {
    constraints.deviceId = { exact: deviceId };
  }

  return constraints;
}

export async function applySink(
  audioElement: HTMLAudioElement,
  selectedOutputId: string,
) {
  const sinkAudio = audioElement as SinkAudioElement;
  const sinkId = selectedOutputId === DEFAULT_OUTPUT_ID ? '' : selectedOutputId;

  if (!sinkAudio.setSinkId) {
    if (sinkId) {
      throw new Error('This browser can only play through the system output.');
    }

    return;
  }

  await sinkAudio.setSinkId(sinkId);
}
