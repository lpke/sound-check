import { DEFAULT_OUTPUT_ID } from './types';

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
