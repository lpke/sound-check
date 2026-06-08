import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from 'react';
import { createClipOutputGraph } from '@/utils/audio';
import { createInitialRecordedPlayback } from '@/utils/soundCheckState';
import type {
  ActiveOutputGraph,
  FrequencyLevels,
  LevelSetter,
  NamedRecordedClip,
} from '@/utils/types';
import { clamp, toErrorMessage } from '@/utils/utils';

type UseRecordedPlaybackOptions = {
  appPaused: boolean;
  clearOutputSlotLevel: (slot: 'recording') => void;
  clearOutputSlotSpectrum: (slot: 'recording') => void;
  outputMuted: boolean;
  recordedClips: NamedRecordedClip[];
  resetRecordedPlaybackOutput: () => void;
  routeRecordedPlaybackStreamToOutput: (stream: MediaStream) => Promise<void>;
  selectedOutputName: string;
  selectedRecordedClip: NamedRecordedClip | null;
  setErrorMessage: (message: string) => void;
  setOutputSlotLevel: (
    slot: 'recording',
    nextLevel: Parameters<LevelSetter>[0],
  ) => void;
  setOutputSlotSpectrum: (
    slot: 'recording',
    nextSpectrum: FrequencyLevels,
  ) => void;
  setSelectedRecordingId: Dispatch<SetStateAction<string | null>>;
  setStatusMessage: (message: string) => void;
};

export function useRecordedPlayback({
  appPaused,
  clearOutputSlotLevel,
  clearOutputSlotSpectrum,
  outputMuted,
  recordedClips,
  resetRecordedPlaybackOutput,
  routeRecordedPlaybackStreamToOutput,
  selectedOutputName,
  selectedRecordedClip,
  setErrorMessage,
  setOutputSlotLevel,
  setOutputSlotSpectrum,
  setSelectedRecordingId,
  setStatusMessage,
}: UseRecordedPlaybackOptions) {
  const recordedPlaybackOutputGraphRef = useRef<ActiveOutputGraph | null>(null);
  const recordedProgressTimerRef = useRef<number | null>(null);
  const [recordedPlayback, setRecordedPlayback] = useState(
    createInitialRecordedPlayback,
  );
  const [isRecordingPlaybackActive, setIsRecordingPlaybackActive] =
    useState(false);

  const stopRecordedProgressLoop = useCallback(() => {
    if (recordedProgressTimerRef.current === null) {
      return;
    }

    window.clearInterval(recordedProgressTimerRef.current);
    recordedProgressTimerRef.current = null;
  }, []);

  const startRecordedProgressLoop = useCallback(
    (clipId: string) => {
      stopRecordedProgressLoop();

      const syncRecordedPlayback = () => {
        const activeGraph = recordedPlaybackOutputGraphRef.current;

        if (!activeGraph?.getCurrentTime) {
          return;
        }

        const durationSeconds = activeGraph.durationSeconds ?? 0;
        const positionSeconds = clamp(
          activeGraph.getCurrentTime(),
          0,
          durationSeconds,
        );

        setRecordedPlayback((currentPlayback) => ({
          ...currentPlayback,
          activeClipId: clipId,
          isPlaying: activeGraph.isPaused ? !activeGraph.isPaused() : true,
          positionsByClipId: {
            ...currentPlayback.positionsByClipId,
            [clipId]: positionSeconds,
          },
        }));
      };

      syncRecordedPlayback();
      recordedProgressTimerRef.current = window.setInterval(
        syncRecordedPlayback,
        120,
      );
    },
    [stopRecordedProgressLoop],
  );

  const stopRecordedPlaybackOutputGraph = useCallback(
    ({
      resetRecordedPosition = false,
    }: { resetRecordedPosition?: boolean } = {}) => {
      const activeGraph = recordedPlaybackOutputGraphRef.current;

      stopRecordedProgressLoop();
      recordedPlaybackOutputGraphRef.current = null;
      setIsRecordingPlaybackActive(false);

      if (activeGraph) {
        activeGraph.cancel();
        activeGraph.context.close().catch(() => undefined);
      }

      resetRecordedPlaybackOutput();
      clearOutputSlotLevel('recording');
      clearOutputSlotSpectrum('recording');
      setRecordedPlayback((currentPlayback) => {
        const activeClipId = currentPlayback.activeClipId;

        if (!activeClipId) {
          return { ...currentPlayback, isPlaying: false };
        }

        const durationSeconds = activeGraph?.durationSeconds ?? 0;
        const currentPosition = activeGraph?.getCurrentTime
          ? clamp(activeGraph.getCurrentTime(), 0, durationSeconds)
          : (currentPlayback.positionsByClipId[activeClipId] ?? 0);

        return {
          ...currentPlayback,
          isPlaying: false,
          positionsByClipId: {
            ...currentPlayback.positionsByClipId,
            [activeClipId]: resetRecordedPosition ? 0 : currentPosition,
          },
        };
      });
    },
    [
      clearOutputSlotLevel,
      clearOutputSlotSpectrum,
      resetRecordedPlaybackOutput,
      stopRecordedProgressLoop,
    ],
  );

  const playRecordedClip = useCallback(
    async (clipId?: string) => {
      const clip =
        clipId === undefined
          ? (selectedRecordedClip ?? recordedClips.at(-1))
          : (recordedClips.find((item) => item.id === clipId) ?? null);

      if (!clip) {
        return;
      }

      if (appPaused || outputMuted) {
        setStatusMessage(
          outputMuted
            ? 'Unmute the speaker section before playing audio.'
            : 'Resume the app before playing audio.',
        );
        return;
      }

      const startAtSeconds = clamp(
        recordedPlayback.positionsByClipId[clip.id] ?? 0,
        0,
        clip.durationSeconds,
      );

      setErrorMessage('');
      setSelectedRecordingId(clip.id);
      stopRecordedPlaybackOutputGraph();

      try {
        recordedPlaybackOutputGraphRef.current = await createClipOutputGraph({
          blob: clip.blob,
          onEnded: () =>
            stopRecordedPlaybackOutputGraph({
              resetRecordedPosition: true,
            }),
          routeStreamToOutput: routeRecordedPlaybackStreamToOutput,
          setOutputLevel: (nextLevel) =>
            setOutputSlotLevel('recording', nextLevel),
          setOutputSpectrum: (nextSpectrum) =>
            setOutputSlotSpectrum('recording', nextSpectrum),
          startAtSeconds,
        });
        setIsRecordingPlaybackActive(true);
        setRecordedPlayback((currentPlayback) => ({
          ...currentPlayback,
          activeClipId: clip.id,
          isPlaying: true,
          positionsByClipId: {
            ...currentPlayback.positionsByClipId,
            [clip.id]: clamp(
              startAtSeconds,
              0,
              recordedPlaybackOutputGraphRef.current?.durationSeconds ??
                clip.durationSeconds,
            ),
          },
        }));
        startRecordedProgressLoop(clip.id);
        setStatusMessage(`Playing recording on ${selectedOutputName}.`);
      } catch (error) {
        stopRecordedPlaybackOutputGraph();
        setErrorMessage(toErrorMessage(error));
      }
    },
    [
      appPaused,
      outputMuted,
      recordedClips,
      recordedPlayback.positionsByClipId,
      routeRecordedPlaybackStreamToOutput,
      selectedOutputName,
      selectedRecordedClip,
      setErrorMessage,
      setOutputSlotLevel,
      setOutputSlotSpectrum,
      setSelectedRecordingId,
      setStatusMessage,
      startRecordedProgressLoop,
      stopRecordedPlaybackOutputGraph,
    ],
  );

  const pauseRecordedClip = useCallback(() => {
    const activeClipId = recordedPlayback.activeClipId;
    const activeGraph = recordedPlaybackOutputGraphRef.current;

    if (!activeClipId || !activeGraph?.pause) {
      return;
    }

    const durationSeconds = activeGraph.durationSeconds ?? 0;
    const positionSeconds = clamp(
      activeGraph.getCurrentTime?.() ??
        recordedPlayback.positionsByClipId[activeClipId] ??
        0,
      0,
      durationSeconds,
    );

    activeGraph.pause();
    stopRecordedProgressLoop();
    setRecordedPlayback((currentPlayback) => ({
      ...currentPlayback,
      isPlaying: false,
      positionsByClipId: {
        ...currentPlayback.positionsByClipId,
        [activeClipId]: positionSeconds,
      },
    }));
    setStatusMessage('Recording paused.');
  }, [
    recordedPlayback.activeClipId,
    recordedPlayback.positionsByClipId,
    setStatusMessage,
    stopRecordedProgressLoop,
  ]);

  const resumeRecordedClip = useCallback(
    (clipId: string) => {
      if (appPaused || outputMuted) {
        setStatusMessage(
          outputMuted
            ? 'Unmute the speaker section before playing audio.'
            : 'Resume the app before playing audio.',
        );
        return;
      }

      const activeGraph = recordedPlaybackOutputGraphRef.current;
      const positionSeconds = recordedPlayback.positionsByClipId[clipId] ?? 0;

      if (recordedPlayback.activeClipId === clipId && activeGraph?.playFrom) {
        activeGraph.playFrom(positionSeconds);
        setRecordedPlayback((currentPlayback) => ({
          ...currentPlayback,
          activeClipId: clipId,
          isPlaying: true,
        }));
        startRecordedProgressLoop(clipId);
        setStatusMessage(`Playing recording on ${selectedOutputName}.`);
        return;
      }

      void playRecordedClip(clipId);
    },
    [
      appPaused,
      outputMuted,
      playRecordedClip,
      recordedPlayback.activeClipId,
      recordedPlayback.positionsByClipId,
      selectedOutputName,
      setStatusMessage,
      startRecordedProgressLoop,
    ],
  );

  const toggleRecordedClipPlayback = useCallback(
    (clipId: string) => {
      if (
        recordedPlayback.activeClipId === clipId &&
        recordedPlayback.isPlaying
      ) {
        pauseRecordedClip();
        return;
      }

      resumeRecordedClip(clipId);
    },
    [
      pauseRecordedClip,
      recordedPlayback.activeClipId,
      recordedPlayback.isPlaying,
      resumeRecordedClip,
    ],
  );

  const handleRecordedClipSeek = useCallback(
    (clipId: string, positionSeconds: number) => {
      const clip = recordedClips.find((item) => item.id === clipId);

      if (!clip) {
        return;
      }

      const nextPosition = clamp(positionSeconds, 0, clip.durationSeconds);
      const isActiveClip =
        recordedPlayback.activeClipId === clipId &&
        recordedPlaybackOutputGraphRef.current !== null;
      const activeGraph = isActiveClip
        ? recordedPlaybackOutputGraphRef.current
        : null;
      const wasPlaying = activeGraph?.isPaused
        ? !activeGraph.isPaused()
        : isActiveClip && recordedPlayback.isPlaying;

      if (activeGraph?.playFrom) {
        activeGraph.playFrom(nextPosition);

        if (wasPlaying) {
          startRecordedProgressLoop(clipId);
        } else {
          activeGraph.pause?.();
          stopRecordedProgressLoop();
        }
      }

      setRecordedPlayback((currentPlayback) => ({
        ...currentPlayback,
        activeClipId: isActiveClip ? clipId : currentPlayback.activeClipId,
        isPlaying: isActiveClip ? wasPlaying : currentPlayback.isPlaying,
        positionsByClipId: {
          ...currentPlayback.positionsByClipId,
          [clipId]: nextPosition,
        },
      }));
    },
    [
      recordedClips,
      recordedPlayback.activeClipId,
      recordedPlayback.isPlaying,
      startRecordedProgressLoop,
      stopRecordedProgressLoop,
    ],
  );

  return {
    handleRecordedClipSeek,
    isRecordingPlaybackActive,
    playRecordedClip,
    recordedPlayback,
    setRecordedPlayback,
    stopRecordedPlaybackOutputGraph,
    toggleRecordedClipPlayback,
  };
}
