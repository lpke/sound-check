import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  clampAudioBitrateKbps,
  encodeAudioBlobAtBitrate,
  isAbortError,
} from '@/utils/audioBitrate';
import { revokeRecordedClipUrls } from '@/utils/recordedClipStorage';
import {
  createClipId,
  type RecordedPlaybackState,
} from '@/utils/soundCheckState';
import type { NamedRecordedClip } from '@/utils/types';
import { toErrorMessage } from '@/utils/utils';

type UseRecordedClipActionsOptions = {
  cancelAllRecordingBitrateEncodes: () => void;
  cancelRecordingBitrateEncode: (clipId: string) => void;
  recordedClips: NamedRecordedClip[];
  recordedPlayback: RecordedPlaybackState;
  setErrorMessage: (message: string) => void;
  setRecordedClips: Dispatch<SetStateAction<NamedRecordedClip[]>>;
  setRecordedPlayback: Dispatch<SetStateAction<RecordedPlaybackState>>;
  setSelectedRecordingId: Dispatch<SetStateAction<string | null>>;
  setStatusMessage: (message: string) => void;
  stopRecordedPlaybackOutputGraph: (options?: {
    resetRecordedPosition?: boolean;
  }) => void;
};

export function useRecordedClipActions({
  cancelAllRecordingBitrateEncodes,
  cancelRecordingBitrateEncode,
  recordedClips,
  recordedPlayback,
  setErrorMessage,
  setRecordedClips,
  setRecordedPlayback,
  setSelectedRecordingId,
  setStatusMessage,
  stopRecordedPlaybackOutputGraph,
}: UseRecordedClipActionsOptions) {
  const recordedClipsRef = useRef(recordedClips);

  useEffect(() => {
    recordedClipsRef.current = recordedClips;
  }, [recordedClips]);

  const renameRecordedClip = useCallback(
    (clipId: string, nextName: string) => {
      setRecordedClips((currentClips) =>
        currentClips.map((clip) =>
          clip.id === clipId ? { ...clip, name: nextName } : clip,
        ),
      );
    },
    [setRecordedClips],
  );

  const deleteRecordedClip = useCallback(
    (clipId: string) => {
      const clip = recordedClips.find((item) => item.id === clipId);

      if (!clip) {
        return;
      }

      if (recordedPlayback.activeClipId === clipId) {
        stopRecordedPlaybackOutputGraph({ resetRecordedPosition: true });
      }

      cancelRecordingBitrateEncode(clipId);
      setRecordedClips((currentClips) =>
        currentClips.filter((currentClip) => currentClip.id !== clipId),
      );
      setRecordedPlayback((currentPlayback) => {
        const positionsByClipId = { ...currentPlayback.positionsByClipId };

        delete positionsByClipId[clipId];

        return {
          activeClipId:
            currentPlayback.activeClipId === clipId
              ? null
              : currentPlayback.activeClipId,
          isPlaying:
            currentPlayback.activeClipId === clipId
              ? false
              : currentPlayback.isPlaying,
          positionsByClipId,
        };
      });
      setSelectedRecordingId((currentClipId) =>
        currentClipId === clipId ? null : currentClipId,
      );
      revokeRecordedClipUrls([clip]);
      setStatusMessage('Recording deleted.');
    },
    [
      recordedClips,
      recordedPlayback.activeClipId,
      cancelRecordingBitrateEncode,
      setRecordedClips,
      setRecordedPlayback,
      setSelectedRecordingId,
      setStatusMessage,
      stopRecordedPlaybackOutputGraph,
    ],
  );

  const deleteAllRecordedClips = useCallback(() => {
    if (recordedClips.length === 0) {
      return;
    }

    stopRecordedPlaybackOutputGraph({ resetRecordedPosition: true });
    cancelAllRecordingBitrateEncodes();
    setRecordedClips((currentClips) => {
      revokeRecordedClipUrls(currentClips);

      return [];
    });
    setRecordedPlayback({
      activeClipId: null,
      isPlaying: false,
      positionsByClipId: {},
    });
    setSelectedRecordingId(null);
    setStatusMessage('All recordings deleted.');
  }, [
    recordedClips.length,
    cancelAllRecordingBitrateEncodes,
    setRecordedClips,
    setRecordedPlayback,
    setSelectedRecordingId,
    setStatusMessage,
    stopRecordedPlaybackOutputGraph,
  ]);

  const selectRecordedClip = useCallback(
    (clipId: string | null) => {
      setSelectedRecordingId(clipId);
    },
    [setSelectedRecordingId],
  );

  const duplicateRecordedClipWithBitrate = useCallback(
    async ({
      bitrateKbps,
      clipId,
      name,
      onProgress,
      signal,
    }: {
      bitrateKbps: number;
      clipId: string;
      name: string;
      onProgress?: (progressPercent: number) => void;
      signal?: AbortSignal;
    }) => {
      const sourceClip = recordedClipsRef.current.find(
        (clip) => clip.id === clipId,
      );

      if (!sourceClip) {
        return null;
      }

      const sourceMaxBitrateKbps = clampAudioBitrateKbps(
        sourceClip.averageBitrateKbps ?? bitrateKbps,
      );
      const targetBitrateKbps = Math.min(
        clampAudioBitrateKbps(bitrateKbps),
        sourceMaxBitrateKbps,
      );

      setErrorMessage('');
      setStatusMessage(`Encoding duplicate at ${targetBitrateKbps} kbps.`);

      try {
        const encodedClip = await encodeAudioBlobAtBitrate({
          bitrateKbps: targetBitrateKbps,
          blob: sourceClip.blob,
          durationSeconds: sourceClip.durationSeconds,
          onProgress,
          signal,
        });
        const duplicateClipId = createClipId();
        const originalAverageBitrateKbps =
          sourceClip.originalAverageBitrateKbps ??
          sourceClip.averageBitrateKbps;

        if (!recordedClipsRef.current.some((clip) => clip.id === clipId)) {
          revokeRecordedClipUrls([encodedClip]);
          return null;
        }

        setRecordedClips((currentClips) => {
          const sourceClipIndex = currentClips.findIndex(
            (currentClip) => currentClip.id === clipId,
          );

          if (sourceClipIndex === -1) {
            revokeRecordedClipUrls([encodedClip]);
            return currentClips;
          }

          const duplicateClip: NamedRecordedClip = {
            ...sourceClip,
            averageBitrateKbps: encodedClip.averageBitrateKbps,
            bitrateModified: true,
            blob: encodedClip.blob,
            createdAt: Date.now(),
            durationSeconds: encodedClip.durationSeconds,
            id: duplicateClipId,
            mimeType: encodedClip.mimeType,
            name,
            originalAverageBitrateKbps,
            targetBitrateKbps,
            url: encodedClip.url,
          };
          const nextClips = [...currentClips];

          nextClips.splice(sourceClipIndex + 1, 0, duplicateClip);

          return nextClips;
        });
        setRecordedPlayback((currentPlayback) => ({
          ...currentPlayback,
          positionsByClipId: {
            ...currentPlayback.positionsByClipId,
            [duplicateClipId]: 0,
          },
        }));
        setSelectedRecordingId(duplicateClipId);
        setStatusMessage(`Duplicate saved at ${targetBitrateKbps} kbps.`);

        return duplicateClipId;
      } catch (error) {
        if (isAbortError(error)) {
          return null;
        }

        setErrorMessage(`Recording duplicate failed: ${toErrorMessage(error)}`);
        throw error;
      }
    },
    [
      setErrorMessage,
      setRecordedClips,
      setRecordedPlayback,
      setSelectedRecordingId,
      setStatusMessage,
    ],
  );

  return {
    deleteAllRecordedClips,
    deleteRecordedClip,
    duplicateRecordedClipWithBitrate,
    renameRecordedClip,
    selectRecordedClip,
  };
}
