import { createAudioContext, getPreferredMimeType } from './audio';
import { clamp } from './utils';

export const MIN_AUDIO_BITRATE_KBPS = 3;
export const MAX_AUDIO_BITRATE_KBPS = 510;
export const DEFAULT_CALL_AUDIO_BITRATE_KBPS = 64;

type EncodeAudioBlobAtBitrateOptions = {
  bitrateKbps: number;
  blob: Blob;
  durationSeconds: number;
  onProgress?: (progressPercent: number) => void;
  signal?: AbortSignal;
};

export type EncodedAudioBlob = {
  averageBitrateKbps: number | null;
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
  targetBitrateKbps: number;
  url: string;
};

export function clampAudioBitrateKbps(value: number) {
  return Math.round(
    clamp(value, MIN_AUDIO_BITRATE_KBPS, MAX_AUDIO_BITRATE_KBPS),
  );
}

export function getAverageBitrateKbps({
  byteSize,
  durationSeconds,
}: {
  byteSize: number;
  durationSeconds: number;
}) {
  if (byteSize <= 0 || durationSeconds <= 0) {
    return null;
  }

  return Math.max(1, Math.round((byteSize * 8) / durationSeconds / 1000));
}

export function getAverageBlobBitrateKbps(blob: Blob, durationSeconds: number) {
  return getAverageBitrateKbps({
    byteSize: blob.size,
    durationSeconds,
  });
}

export function formatBitrateKbps(bitrateKbps: number | null | undefined) {
  if (!bitrateKbps || bitrateKbps <= 0) {
    return 'Unknown';
  }

  return `${Math.round(bitrateKbps).toLocaleString()} kbps`;
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function createAbortError() {
  return new DOMException('Audio encode cancelled.', 'AbortError');
}

export async function encodeAudioBlobAtBitrate({
  bitrateKbps,
  blob,
  durationSeconds,
  onProgress,
  signal,
}: EncodeAudioBlobAtBitrateOptions): Promise<EncodedAudioBlob> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is unavailable in this browser.');
  }

  if (signal?.aborted) {
    throw createAbortError();
  }

  const targetBitrateKbps = clampAudioBitrateKbps(bitrateKbps);
  const context = createAudioContext();

  try {
    const audioData = await blob.arrayBuffer();

    if (signal?.aborted) {
      throw createAbortError();
    }

    const audioBuffer = await context.decodeAudioData(audioData);

    if (signal?.aborted) {
      throw createAbortError();
    }

    if (audioBuffer.duration <= 0) {
      throw new Error('Recording has no audio to encode.');
    }

    const source = context.createBufferSource();
    const destination = context.createMediaStreamDestination();
    const mimeType = getPreferredMimeType();
    const chunks: Blob[] = [];
    let progressTimer: number | null = null;
    let startedAtSeconds = 0;

    source.buffer = audioBuffer;
    source.connect(destination);

    await context.resume();

    const recorder = new MediaRecorder(destination.stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: targetBitrateKbps * 1000,
    });

    return await new Promise<EncodedAudioBlob>((resolve, reject) => {
      let settled = false;

      function cleanup() {
        signal?.removeEventListener('abort', handleAbort);

        if (progressTimer !== null) {
          window.clearInterval(progressTimer);
          progressTimer = null;
        }

        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            // Recorder may already be stopping after a cancellation.
          }
        }

        destination.stream.getTracks().forEach((track) => track.stop());

        try {
          source.stop();
        } catch {
          // Source may not have started or may already have ended.
        }

        try {
          source.disconnect();
        } catch {
          // Source may already be disconnected after an encode failure.
        }

        try {
          destination.disconnect();
        } catch {
          // Destination may not have active downstream connections.
        }

        context.close().catch(() => undefined);
      }

      function rejectOnce(error: unknown) {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(error);
      }

      function handleAbort() {
        rejectOnce(createAbortError());
      }

      signal?.addEventListener('abort', handleAbort, { once: true });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        rejectOnce(event.error ?? new Error('Recording encode failed.'));
      };

      recorder.onstop = () => {
        if (settled) {
          return;
        }

        settled = true;
        onProgress?.(100);

        if (chunks.length === 0) {
          cleanup();
          reject(new Error('Recording encode produced no audio.'));
          return;
        }

        const encodedBlob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });

        cleanup();
        resolve({
          averageBitrateKbps: getAverageBlobBitrateKbps(
            encodedBlob,
            durationSeconds,
          ),
          blob: encodedBlob,
          durationSeconds,
          mimeType: encodedBlob.type || recorder.mimeType || 'audio/webm',
          targetBitrateKbps,
          url: URL.createObjectURL(encodedBlob),
        });
      };

      recorder.onstart = () => {
        if (signal?.aborted) {
          rejectOnce(createAbortError());
          return;
        }

        startedAtSeconds = context.currentTime;
        onProgress?.(0);

        try {
          source.start();
        } catch (error) {
          rejectOnce(error);
          return;
        }

        progressTimer = window.setInterval(() => {
          const elapsedSeconds = Math.max(
            0,
            context.currentTime - startedAtSeconds,
          );
          const progressPercent =
            durationSeconds > 0
              ? clamp((elapsedSeconds / durationSeconds) * 100, 0, 98)
              : 0;

          onProgress?.(progressPercent);
        }, 120);
      };

      source.onended = () => {
        if (!settled && recorder.state !== 'inactive') {
          recorder.stop();
        }
      };

      try {
        recorder.start(250);
      } catch (error) {
        rejectOnce(error);
      }
    });
  } catch (error) {
    context.close().catch(() => undefined);
    throw error;
  }
}
