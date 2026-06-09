import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from 'react';
import { createClipId, type MusicPlaybackState } from '@/utils/soundCheckState';
import type { ActiveOutputGraph, SpeakerTestSettings } from '@/utils/types';
import { clamp } from '@/utils/utils';

type UseMusicPlaybackControlsOptions = {
  appPaused: boolean;
  musicOutputGraphRef: RefObject<ActiveOutputGraph | null>;
  musicPlayback: MusicPlaybackState;
  outputMuted: boolean;
  pendingMusicStartAtRef: RefObject<number | null>;
  selectedOutputName: string;
  setMusicPlayback: Dispatch<SetStateAction<MusicPlaybackState>>;
  setStatusMessage: (message: string) => void;
  speakerTestSettings: SpeakerTestSettings;
  startMusicProgressLoop: () => void;
  startSpeakerTest: () => Promise<void>;
  stopMusicProgressLoop: () => void;
};

export function useMusicPlaybackControls({
  appPaused,
  musicOutputGraphRef,
  musicPlayback,
  outputMuted,
  pendingMusicStartAtRef,
  selectedOutputName,
  setMusicPlayback,
  setStatusMessage,
  speakerTestSettings,
  startMusicProgressLoop,
  startSpeakerTest,
  stopMusicProgressLoop,
}: UseMusicPlaybackControlsOptions) {
  const pauseMusicPlayback = useCallback(() => {
    const activeGraph = musicOutputGraphRef.current;

    if (!activeGraph?.pause) {
      return;
    }

    const positionSeconds =
      activeGraph.getCurrentTime?.() ?? musicPlayback.positionSeconds;

    activeGraph.pause();
    stopMusicProgressLoop();
    setMusicPlayback((currentPlayback) => ({
      ...currentPlayback,
      durationSeconds:
        activeGraph.durationSeconds ?? currentPlayback.durationSeconds,
      isLoading: false,
      isPlaying: false,
      loadingPhase: null,
      loadingProgressPercent: null,
      positionSeconds,
    }));
    setStatusMessage(
      speakerTestSettings.kind === 'dialUp'
        ? 'Dial-up paused.'
        : 'Music paused.',
    );
  }, [
    musicOutputGraphRef,
    musicPlayback.positionSeconds,
    setMusicPlayback,
    setStatusMessage,
    speakerTestSettings.kind,
    stopMusicProgressLoop,
  ]);

  const resumeMusicPlayback = useCallback(() => {
    if (appPaused || outputMuted) {
      setStatusMessage(
        outputMuted
          ? 'Unmute the speaker section before playing audio.'
          : 'Resume the app before playing audio.',
      );
      return;
    }

    const activeGraph = musicOutputGraphRef.current;

    if (activeGraph?.playFrom) {
      activeGraph.playFrom(musicPlayback.positionSeconds);
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        isLoading: false,
        isPlaying: true,
        loadingPhase: null,
        loadingProgressPercent: null,
      }));
      startMusicProgressLoop();
      setStatusMessage(
        speakerTestSettings.kind === 'dialUp'
          ? `Playing dial-up tones on ${selectedOutputName}.`
          : `Playing music on ${selectedOutputName}.`,
      );
      return;
    }

    pendingMusicStartAtRef.current = musicPlayback.positionSeconds;
    void startSpeakerTest();
  }, [
    appPaused,
    musicOutputGraphRef,
    musicPlayback.positionSeconds,
    outputMuted,
    pendingMusicStartAtRef,
    selectedOutputName,
    setMusicPlayback,
    setStatusMessage,
    speakerTestSettings.kind,
    startMusicProgressLoop,
    startSpeakerTest,
  ]);

  const toggleMusicPlayback = useCallback(() => {
    if (musicPlayback.isLoading) {
      return;
    }

    if (musicPlayback.isPlaying) {
      pauseMusicPlayback();
      return;
    }

    resumeMusicPlayback();
  }, [
    musicPlayback.isLoading,
    musicPlayback.isPlaying,
    pauseMusicPlayback,
    resumeMusicPlayback,
  ]);

  const handleMusicSeek = useCallback(
    (positionSeconds: number) => {
      const activeGraph = musicOutputGraphRef.current;
      const durationSeconds =
        activeGraph?.durationSeconds ?? musicPlayback.durationSeconds;
      const nextPosition = clamp(positionSeconds, 0, durationSeconds || 0);
      const wasPlaying = activeGraph?.isPaused
        ? !activeGraph.isPaused()
        : false;

      if (activeGraph?.playFrom) {
        activeGraph.playFrom(nextPosition);

        if (wasPlaying) {
          startMusicProgressLoop();
        } else {
          activeGraph.pause?.();
          stopMusicProgressLoop();
        }
      }

      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds,
        isLoading: false,
        isPlaying: wasPlaying,
        loadingPhase: null,
        loadingProgressPercent: null,
        positionSeconds: nextPosition,
      }));
    },
    [
      musicOutputGraphRef,
      musicPlayback.durationSeconds,
      setMusicPlayback,
      startMusicProgressLoop,
      stopMusicProgressLoop,
    ],
  );

  const markMusicPosition = useCallback(() => {
    const activeGraph = musicOutputGraphRef.current;
    const durationSeconds =
      activeGraph?.durationSeconds ?? musicPlayback.durationSeconds;

    if (durationSeconds <= 0) {
      return;
    }

    const positionSeconds = clamp(
      activeGraph?.getCurrentTime?.() ?? musicPlayback.positionSeconds,
      0,
      durationSeconds || 0,
    );

    setMusicPlayback((currentPlayback) => ({
      ...currentPlayback,
      marks: [
        ...currentPlayback.marks,
        {
          id: createClipId(),
          seconds: positionSeconds,
        },
      ],
      positionSeconds,
    }));
  }, [
    musicOutputGraphRef,
    musicPlayback.durationSeconds,
    musicPlayback.positionSeconds,
    setMusicPlayback,
  ]);

  const playMusicFromMark = useCallback(
    (markSeconds: number) => {
      const activeGraph = musicOutputGraphRef.current;
      const durationSeconds =
        activeGraph?.durationSeconds ?? musicPlayback.durationSeconds;
      const positionSeconds = clamp(markSeconds, 0, durationSeconds || 0);

      if (activeGraph?.playFrom) {
        activeGraph.playFrom(positionSeconds);
        startMusicProgressLoop();
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          isLoading: false,
          isPlaying: true,
          loadingPhase: null,
          loadingProgressPercent: null,
          positionSeconds,
        }));
        setStatusMessage(`Playing music on ${selectedOutputName}.`);
        return;
      }

      pendingMusicStartAtRef.current = positionSeconds;
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        positionSeconds,
      }));
      void startSpeakerTest();
    },
    [
      musicOutputGraphRef,
      musicPlayback.durationSeconds,
      pendingMusicStartAtRef,
      selectedOutputName,
      setMusicPlayback,
      setStatusMessage,
      startMusicProgressLoop,
      startSpeakerTest,
    ],
  );

  const deleteMusicMark = useCallback(
    (markId: string) => {
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        marks: currentPlayback.marks.filter((mark) => mark.id !== markId),
      }));
    },
    [setMusicPlayback],
  );

  return {
    deleteMusicMark,
    handleMusicSeek,
    markMusicPosition,
    pauseMusicPlayback,
    playMusicFromMark,
    resumeMusicPlayback,
    toggleMusicPlayback,
  };
}
