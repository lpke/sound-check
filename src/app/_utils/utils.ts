export function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

export function joinClasses(
  ...classes: Array<false | null | string | undefined>
) {
  return classes.filter(Boolean).join(' ');
}

export function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}.${tenths}`;
}

export function toErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Permission denied. Allow microphone access in the browser.';
    }

    if (error.name === 'NotFoundError') {
      return 'Selected audio device was not found.';
    }

    if (error.name === 'NotReadableError') {
      return 'Audio device is already in use or unavailable.';
    }

    return error.message || error.name;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected audio error.';
}
