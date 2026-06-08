import { type Dispatch, type SetStateAction, useCallback } from 'react';
import { revokeRecordedClipUrls } from '@/utils/recordedClipStorage';
import type { RecordedPlaybackState } from '@/utils/soundCheckState';
import type { NamedRecordedClip } from '@/utils/types';

type UseRecordedClipActionsOptions = {
  recordedClips: NamedRecordedClip[];
  recordedPlayback: RecordedPlaybackState;
  setRecordedClips: Dispatch<SetStateAction<NamedRecordedClip[]>>;
  setRecordedPlayback: Dispatch<SetStateAction<RecordedPlaybackState>>;
  setSelectedRecordingId: Dispatch<SetStateAction<string | null>>;
  setStatusMessage: (message: string) => void;
  stopRecordedPlaybackOutputGraph: (options?: {
    resetRecordedPosition?: boolean;
  }) => void;
};

export function useRecordedClipActions({
  recordedClips,
  recordedPlayback,
  setRecordedClips,
  setRecordedPlayback,
  setSelectedRecordingId,
  setStatusMessage,
  stopRecordedPlaybackOutputGraph,
}: UseRecordedClipActionsOptions) {
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

  return {
    deleteAllRecordedClips,
    deleteRecordedClip,
    renameRecordedClip,
    selectRecordedClip,
  };
}
