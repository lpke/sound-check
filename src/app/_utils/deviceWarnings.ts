import { DEFAULT_OUTPUT_ID, type AudioDevice } from './types';

type DeviceWarningStateOptions = {
  inputDevices: AudioDevice[];
  outputDevices: AudioDevice[];
  selectedInputId: string;
  selectedOutputId: string;
};

export function hasDeviceQualityWarning({
  inputDevices,
  outputDevices,
  selectedInputId,
  selectedOutputId,
}: DeviceWarningStateOptions) {
  const selectedInputDevice = inputDevices.find(
    (device) => device.deviceId === selectedInputId,
  );
  const selectedOutputDevice = outputDevices.find(
    (device) => device.deviceId === selectedOutputId,
  );

  return (
    selectedInputId === DEFAULT_OUTPUT_ID ||
    selectedOutputId === DEFAULT_OUTPUT_ID ||
    hasSharedDeviceGroup(selectedInputDevice, selectedOutputDevice)
  );
}

export function hasSharedDeviceGroup(
  inputDevice: AudioDevice | undefined,
  outputDevice: AudioDevice | undefined,
) {
  return Boolean(
    inputDevice?.groupId && inputDevice.groupId === outputDevice?.groupId,
  );
}

export function getDefaultDeviceUncertaintyMessage(
  selectedInputId: string,
  selectedOutputId: string,
) {
  const inputIsDefault = selectedInputId === DEFAULT_OUTPUT_ID;
  const outputIsDefault = selectedOutputId === DEFAULT_OUTPUT_ID;

  if (inputIsDefault && outputIsDefault) {
    return "Since they're set to default, it's not possible to tell whether they are the same device.";
  }

  if (inputIsDefault) {
    return "Since the mic is set to default, it's not possible to tell whether the mic and speaker are the same device.";
  }

  if (outputIsDefault) {
    return "Since the speaker is set to default, it's not possible to tell whether the mic and speaker are the same device.";
  }

  return '';
}
