import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  createRecordedClipStorageSnapshot,
  loadRecordedClipsFromStorage,
  revokeRecordedClipUrls,
  writeRecordedClipStorageSnapshot,
} from '@/utils/recordedClipStorage';
import {
  mergeRecordedClips,
  type RecordedPlaybackState,
} from '@/utils/soundCheckState';
import type { NamedRecordedClip } from '@/utils/types';
import { toErrorMessage } from '@/utils/utils';

type UseRecordedClipStorageSyncOptions = {
  recordedClips: NamedRecordedClip[];
  setErrorMessage: (message: string) => void;
  setRecordedClips: Dispatch<SetStateAction<NamedRecordedClip[]>>;
  setRecordedPlayback: Dispatch<SetStateAction<RecordedPlaybackState>>;
  setSelectedRecordingId: Dispatch<SetStateAction<string | null>>;
};

export function useRecordedClipStorageSync({
  recordedClips,
  setErrorMessage,
  setRecordedClips,
  setRecordedPlayback,
  setSelectedRecordingId,
}: UseRecordedClipStorageSyncOptions) {
  const recordedClipsRef = useRef<NamedRecordedClip[]>([]);
  const recordedClipSaveRequestRef = useRef(0);
  const [isRecordedClipStorageReady, setIsRecordedClipStorageReady] =
    useState(false);

  useEffect(() => {
    recordedClipsRef.current = recordedClips;
  }, [recordedClips]);

  useEffect(() => {
    let cancelled = false;

    void loadRecordedClipsFromStorage()
      .then((storedClips) => {
        if (cancelled) {
          revokeRecordedClipUrls(storedClips);
          return;
        }

        if (storedClips.length === 0) {
          return;
        }

        setRecordedClips((currentClips) =>
          mergeRecordedClips(storedClips, currentClips),
        );
        setRecordedPlayback((currentPlayback) => {
          const positionsByClipId = { ...currentPlayback.positionsByClipId };

          storedClips.forEach((clip) => {
            positionsByClipId[clip.id] ??= 0;
          });

          return {
            ...currentPlayback,
            positionsByClipId,
          };
        });
        setSelectedRecordingId(
          (currentClipId) => currentClipId ?? storedClips.at(-1)?.id ?? null,
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            `Saved recordings could not be loaded: ${toErrorMessage(error)}`,
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRecordedClipStorageReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    setErrorMessage,
    setRecordedClips,
    setRecordedPlayback,
    setSelectedRecordingId,
  ]);

  useEffect(() => {
    if (!isRecordedClipStorageReady) {
      return undefined;
    }

    const saveRequestId = recordedClipSaveRequestRef.current + 1;
    let cancelled = false;

    recordedClipSaveRequestRef.current = saveRequestId;

    void createRecordedClipStorageSnapshot(recordedClips)
      .then((snapshot) => {
        if (cancelled || recordedClipSaveRequestRef.current !== saveRequestId) {
          return;
        }

        writeRecordedClipStorageSnapshot(snapshot);
      })
      .catch((error) => {
        if (
          !cancelled &&
          recordedClipSaveRequestRef.current === saveRequestId
        ) {
          setErrorMessage(
            `Recordings could not be saved locally: ${toErrorMessage(error)}`,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isRecordedClipStorageReady, recordedClips, setErrorMessage]);

  useEffect(() => {
    return () => {
      revokeRecordedClipUrls(recordedClipsRef.current);
    };
  }, []);
}
