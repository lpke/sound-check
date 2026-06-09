import { useCallback, useRef, useState } from 'react';
import {
  createMusicOutputGraph,
  createSpeakerTestOutputGraph,
} from '@/utils/audio';
import { readResponseArrayBufferWithProgress } from '@/utils/audioLoading';
import {
  getSpeakerMusicQualityOption,
  speakerMusicTracks,
} from '@/utils/speakerMusic';
import {
  createInitialMusicPlayback,
  defaultSpeakerTestSettings,
  DIAL_UP_AUDIO_PATH,
  DIAL_UP_PLAYBACK_GAIN,
} from '@/utils/soundCheckState';
import { useMusicPlaybackControls } from '@/hooks/useMusicPlaybackControls';
import { useSpeakerTestSettingControls } from '@/hooks/useSpeakerTestSettingControls';
import type {
  ActiveOutputGraph,
  FrequencyLevels,
  LevelSetter,
} from '@/utils/types';
import { clamp, toErrorMessage } from '@/utils/utils';

type UseSpeakerTestPlaybackOptions = {
  appPaused: boolean;
  clearOutputSlotLevel: (slot: 'music') => void;
  clearOutputSlotSpectrum: (slot: 'music') => void;
  outputMuted: boolean;
  resetPlaybackOutput: () => void;
  routePlaybackStreamToOutput: (stream: MediaStream) => Promise<void>;
  selectedOutputName: string;
  setErrorMessage: (message: string) => void;
  setOutputSlotLevel: (
    slot: 'music',
    nextLevel: Parameters<LevelSetter>[0],
  ) => void;
  setOutputSlotSpectrum: (slot: 'music', nextSpectrum: FrequencyLevels) => void;
  setStatusMessage: (message: string) => void;
};

export function useSpeakerTestPlayback({
  appPaused,
  clearOutputSlotLevel,
  clearOutputSlotSpectrum,
  outputMuted,
  resetPlaybackOutput,
  routePlaybackStreamToOutput,
  selectedOutputName,
  setErrorMessage,
  setOutputSlotLevel,
  setOutputSlotSpectrum,
  setStatusMessage,
}: UseSpeakerTestPlaybackOptions) {
  const musicOutputGraphRef = useRef<ActiveOutputGraph | null>(null);
  const musicLoadAbortControllerRef = useRef<AbortController | null>(null);
  const musicLoadIdRef = useRef(0);
  const musicProgressTimerRef = useRef<number | null>(null);
  const pendingMusicStartAtRef = useRef<number | null>(null);
  const [speakerTestSettings, setSpeakerTestSettings] = useState(
    defaultSpeakerTestSettings,
  );
  const [musicPlayback, setMusicPlayback] = useState(
    createInitialMusicPlayback,
  );
  const [isMusicOutputActive, setIsMusicOutputActive] = useState(false);

  const stopMusicProgressLoop = useCallback(() => {
    if (musicProgressTimerRef.current === null) {
      return;
    }

    window.clearInterval(musicProgressTimerRef.current);
    musicProgressTimerRef.current = null;
  }, []);

  const startMusicProgressLoop = useCallback(() => {
    stopMusicProgressLoop();

    const syncMusicPlayback = () => {
      const activeGraph = musicOutputGraphRef.current;

      if (!activeGraph?.getCurrentTime) {
        return;
      }

      const durationSeconds =
        activeGraph.durationSeconds ?? musicPlayback.durationSeconds;
      const positionSeconds = clamp(
        activeGraph.getCurrentTime(),
        0,
        durationSeconds || 0,
      );

      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds,
        isPlaying: !activeGraph.isPaused?.(),
        positionSeconds,
      }));
    };

    syncMusicPlayback();
    musicProgressTimerRef.current = window.setInterval(syncMusicPlayback, 120);
  }, [musicPlayback.durationSeconds, stopMusicProgressLoop]);

  const stopMusicOutputGraph = useCallback(() => {
    const activeGraph = musicOutputGraphRef.current;

    musicLoadIdRef.current += 1;
    musicLoadAbortControllerRef.current?.abort();
    musicLoadAbortControllerRef.current = null;
    stopMusicProgressLoop();
    musicOutputGraphRef.current = null;
    setIsMusicOutputActive(false);

    if (activeGraph) {
      activeGraph.cancel();
      activeGraph.context.close().catch(() => undefined);
    }

    resetPlaybackOutput();
    clearOutputSlotLevel('music');
    clearOutputSlotSpectrum('music');
    setMusicPlayback((currentPlayback) => ({
      ...currentPlayback,
      isLoading: false,
      isPlaying: false,
      loadingPhase: null,
      loadingProgressPercent: null,
      positionSeconds: 0,
    }));
  }, [
    clearOutputSlotLevel,
    clearOutputSlotSpectrum,
    resetPlaybackOutput,
    stopMusicProgressLoop,
  ]);

  const startSpeakerTest = useCallback(async () => {
    if (appPaused || outputMuted) {
      setStatusMessage(
        outputMuted
          ? 'Unmute the speaker section before playing audio.'
          : 'Resume the app before playing audio.',
      );
      return;
    }

    setErrorMessage('');
    stopMusicOutputGraph();

    const loadId = musicLoadIdRef.current;
    const loadAbortController = new AbortController();
    const isCurrentLoad = () => musicLoadIdRef.current === loadId;

    try {
      let playbackStartAtSeconds = musicPlayback.positionSeconds;
      let shouldTrackPlayback = false;
      let nextOutputGraph: ActiveOutputGraph;

      if (speakerTestSettings.kind === 'music') {
        playbackStartAtSeconds =
          pendingMusicStartAtRef.current ?? musicPlayback.positionSeconds;
        const musicSource = speakerTestSettings.musicSource;

        pendingMusicStartAtRef.current = null;

        if (musicSource === 'file' && !speakerTestSettings.musicFile) {
          setStatusMessage('Choose an audio file before playing.');
          return;
        }

        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          isLoading: true,
          isPlaying: false,
          loadingPhase: musicSource === 'file' ? 'decoding' : 'downloading',
          loadingProgressPercent: musicSource === 'file' ? null : 0,
        }));
        musicLoadAbortControllerRef.current = loadAbortController;
        nextOutputGraph = await createMusicOutputGraph({
          getArrayBuffer: async () => {
            if (musicSource === 'file') {
              return (
                speakerTestSettings.musicFile?.arrayBuffer() ??
                Promise.reject(
                  new Error('Choose an audio file before playing.'),
                )
              );
            }

            const selectedTrack = speakerMusicTracks[musicSource];
            const selectedQuality = getSpeakerMusicQualityOption(
              musicSource,
              speakerTestSettings.musicQuality,
            );

            if (!selectedQuality) {
              throw new Error(
                `${selectedTrack.label} has no available music quality.`,
              );
            }

            const response = await fetch(selectedQuality.path, {
              signal: loadAbortController.signal,
            });

            if (!response.ok) {
              throw new Error(`${selectedTrack.label} could not be loaded.`);
            }

            return readResponseArrayBufferWithProgress(
              response,
              ({ percent }) => {
                if (!isCurrentLoad()) {
                  return;
                }

                setMusicPlayback((currentPlayback) => ({
                  ...currentPlayback,
                  isLoading: true,
                  loadingPhase: 'downloading',
                  loadingProgressPercent: percent,
                }));
              },
            );
          },
          onDecodeStart: () => {
            if (!isCurrentLoad()) {
              return;
            }

            setMusicPlayback((currentPlayback) => ({
              ...currentPlayback,
              isLoading: true,
              loadingPhase: 'decoding',
              loadingProgressPercent: null,
            }));
          },
          onEnded: stopMusicOutputGraph,
          routeStreamToOutput: routePlaybackStreamToOutput,
          setOutputLevel: (nextLevel) => setOutputSlotLevel('music', nextLevel),
          setOutputSpectrum: (nextSpectrum) =>
            setOutputSlotSpectrum('music', nextSpectrum),
          startAtSeconds: playbackStartAtSeconds,
        });
        shouldTrackPlayback = true;
      } else if (speakerTestSettings.kind === 'dialUp') {
        playbackStartAtSeconds =
          pendingMusicStartAtRef.current ?? musicPlayback.positionSeconds;

        pendingMusicStartAtRef.current = null;
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          isLoading: true,
          isPlaying: false,
          loadingPhase: null,
          loadingProgressPercent: null,
          marks: [],
        }));
        musicLoadAbortControllerRef.current = loadAbortController;
        nextOutputGraph = await createMusicOutputGraph({
          getArrayBuffer: async () => {
            const response = await fetch(DIAL_UP_AUDIO_PATH, {
              signal: loadAbortController.signal,
            });

            if (!response.ok) {
              throw new Error('Dial-up audio could not be loaded.');
            }

            return response.arrayBuffer();
          },
          onEnded: stopMusicOutputGraph,
          playbackGain: DIAL_UP_PLAYBACK_GAIN,
          routeStreamToOutput: routePlaybackStreamToOutput,
          setOutputLevel: (nextLevel) => setOutputSlotLevel('music', nextLevel),
          setOutputSpectrum: (nextSpectrum) =>
            setOutputSlotSpectrum('music', nextSpectrum),
          startAtSeconds: playbackStartAtSeconds,
        });
        shouldTrackPlayback = true;
      } else {
        nextOutputGraph = await createSpeakerTestOutputGraph({
          kind: speakerTestSettings.kind,
          routeStreamToOutput: routePlaybackStreamToOutput,
          setOutputLevel: (nextLevel) => setOutputSlotLevel('music', nextLevel),
          setOutputSpectrum: (nextSpectrum) =>
            setOutputSlotSpectrum('music', nextSpectrum),
          toneFrequency: speakerTestSettings.toneFrequency,
        });
      }

      if (!isCurrentLoad()) {
        nextOutputGraph.cancel();
        nextOutputGraph.context.close().catch(() => undefined);
        return;
      }

      musicLoadAbortControllerRef.current = null;
      musicOutputGraphRef.current = nextOutputGraph;
      setIsMusicOutputActive(true);
      if (shouldTrackPlayback) {
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          durationSeconds:
            nextOutputGraph.durationSeconds ?? currentPlayback.durationSeconds,
          isLoading: false,
          isPlaying: true,
          loadingPhase: null,
          loadingProgressPercent: null,
          positionSeconds: clamp(
            playbackStartAtSeconds,
            0,
            nextOutputGraph.durationSeconds ?? currentPlayback.durationSeconds,
          ),
        }));
        startMusicProgressLoop();
      }

      setStatusMessage(
        speakerTestSettings.kind === 'music'
          ? `Playing music on ${selectedOutputName}.`
          : speakerTestSettings.kind === 'dialUp'
            ? `Playing dial-up tones on ${selectedOutputName}.`
            : `Playing test sound on ${selectedOutputName}.`,
      );
    } catch (error) {
      if (!isCurrentLoad() || isAbortError(error)) {
        return;
      }

      stopMusicOutputGraph();
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        isLoading: false,
        loadingPhase: null,
        loadingProgressPercent: null,
      }));
      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    musicPlayback.positionSeconds,
    outputMuted,
    routePlaybackStreamToOutput,
    selectedOutputName,
    setErrorMessage,
    setOutputSlotLevel,
    setOutputSlotSpectrum,
    setStatusMessage,
    speakerTestSettings,
    startMusicProgressLoop,
    stopMusicOutputGraph,
  ]);

  const musicControls = useMusicPlaybackControls({
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
  });
  const settingControls = useSpeakerTestSettingControls({
    musicOutputGraphRef,
    setMusicPlayback,
    setSpeakerTestSettings,
    stopMusicOutputGraph,
  });

  return {
    ...musicControls,
    ...settingControls,
    isMusicOutputActive,
    musicPlayback,
    speakerTestSettings,
    startSpeakerTest,
    stopMusicOutputGraph,
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
