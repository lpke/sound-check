export function isMicrophonePermissionError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' ||
      error.name === 'SecurityError' ||
      error.message.includes('Permission denied'))
  );
}
