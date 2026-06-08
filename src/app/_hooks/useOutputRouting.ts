import { useCallback, useEffect, useRef } from 'react';
import { applySink } from '@/utils/devices';
import { toErrorMessage } from '@/utils/utils';

type UseOutputRoutingOptions = {
  appPaused: boolean;
  outputMuted: boolean;
  selectedOutputId: string;
  setErrorMessage: (message: string) => void;
};

export function useOutputRouting({
  appPaused,
  outputMuted,
  selectedOutputId,
  setErrorMessage,
}: UseOutputRoutingOptions) {
  const musicPlaybackAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordedPlaybackAudioRef = useRef<HTMLAudioElement | null>(null);
  const monitorAudioRef = useRef<HTMLAudioElement | null>(null);

  const resetOutputAudio = useCallback(
    (outputAudio: HTMLAudioElement | null) => {
      if (!outputAudio) {
        return;
      }

      outputAudio.pause();
      outputAudio.srcObject = null;
      outputAudio.removeAttribute('src');
      outputAudio.load();
    },
    [],
  );

  const routeStreamToOutput = useCallback(
    async (
      outputAudio: HTMLAudioElement | null,
      stream: MediaStream,
    ): Promise<void> => {
      if (appPaused || outputMuted) {
        throw new Error(
          outputMuted
            ? 'Unmute the speaker section before playing audio.'
            : 'Resume the app before playing audio.',
        );
      }

      if (!outputAudio) {
        throw new Error('Output player is not ready.');
      }

      outputAudio.pause();
      outputAudio.srcObject = stream;
      outputAudio.volume = 1;

      await applySink(outputAudio, selectedOutputId);
      await outputAudio.play();
    },
    [appPaused, outputMuted, selectedOutputId],
  );

  const routePlaybackStreamToOutput = useCallback(
    (stream: MediaStream) =>
      routeStreamToOutput(musicPlaybackAudioRef.current, stream),
    [routeStreamToOutput],
  );

  const routeRecordedPlaybackStreamToOutput = useCallback(
    (stream: MediaStream) =>
      routeStreamToOutput(recordedPlaybackAudioRef.current, stream),
    [routeStreamToOutput],
  );

  const routeMonitorStreamToOutput = useCallback(
    (stream: MediaStream) =>
      routeStreamToOutput(monitorAudioRef.current, stream),
    [routeStreamToOutput],
  );

  const resetMonitorOutput = useCallback(() => {
    resetOutputAudio(monitorAudioRef.current);
  }, [resetOutputAudio]);

  const resetPlaybackOutput = useCallback(() => {
    resetOutputAudio(musicPlaybackAudioRef.current);
  }, [resetOutputAudio]);

  const resetRecordedPlaybackOutput = useCallback(() => {
    resetOutputAudio(recordedPlaybackAudioRef.current);
  }, [resetOutputAudio]);

  useEffect(() => {
    window.queueMicrotask(() => {
      const outputAudioElements = [
        musicPlaybackAudioRef.current,
        recordedPlaybackAudioRef.current,
        monitorAudioRef.current,
      ].filter(Boolean);

      outputAudioElements.forEach((outputAudio) => {
        if (outputAudio) {
          applySink(outputAudio, selectedOutputId).catch((error) => {
            setErrorMessage(toErrorMessage(error));
          });
        }
      });
    });
  }, [selectedOutputId, setErrorMessage]);

  return {
    monitorAudioRef,
    musicPlaybackAudioRef,
    recordedPlaybackAudioRef,
    resetMonitorOutput,
    resetPlaybackOutput,
    resetRecordedPlaybackOutput,
    routeMonitorStreamToOutput,
    routePlaybackStreamToOutput,
    routeRecordedPlaybackStreamToOutput,
  };
}
