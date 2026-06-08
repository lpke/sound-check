import { useCallback, useRef, useState } from 'react';
import {
  createMusicOutputGraph,
  createSpeakerTestOutputGraph,
} from '@/utils/audio';
import { speakerMusicTracks } from '@/utils/speakerMusic';
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

    try {
      let playbackStartAtSeconds = musicPlayback.positionSeconds;
      let shouldTrackPlayback = false;

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
        }));
        musicOutputGraphRef.current = await createMusicOutputGraph({
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
            const response = await fetch(selectedTrack.path);

            if (!response.ok) {
              throw new Error(`${selectedTrack.label} could not be loaded.`);
            }

            return response.arrayBuffer();
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
          marks: [],
        }));
        musicOutputGraphRef.current = await createMusicOutputGraph({
          getArrayBuffer: async () => {
            const response = await fetch(DIAL_UP_AUDIO_PATH);

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
        musicOutputGraphRef.current = await createSpeakerTestOutputGraph({
          kind: speakerTestSettings.kind,
          routeStreamToOutput: routePlaybackStreamToOutput,
          setOutputLevel: (nextLevel) => setOutputSlotLevel('music', nextLevel),
          setOutputSpectrum: (nextSpectrum) =>
            setOutputSlotSpectrum('music', nextSpectrum),
          toneFrequency: speakerTestSettings.toneFrequency,
        });
      }

      setIsMusicOutputActive(true);
      if (shouldTrackPlayback) {
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          durationSeconds:
            musicOutputGraphRef.current?.durationSeconds ??
            currentPlayback.durationSeconds,
          isLoading: false,
          isPlaying: true,
          positionSeconds: clamp(
            playbackStartAtSeconds,
            0,
            musicOutputGraphRef.current?.durationSeconds ??
              currentPlayback.durationSeconds,
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
      stopMusicOutputGraph();
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        isLoading: false,
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
