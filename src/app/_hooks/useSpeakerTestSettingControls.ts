import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from 'react';
import type { MusicPlaybackState } from '@/utils/soundCheckState';
import { getDefaultMusicQuality } from '@/utils/speakerMusic';
import type {
  ActiveOutputGraph,
  SpeakerMusicQuality,
  SpeakerMusicSource,
  SpeakerTestKind,
  SpeakerTestSettings,
} from '@/utils/types';
import { clamp } from '@/utils/utils';

type UseSpeakerTestSettingControlsOptions = {
  musicOutputGraphRef: RefObject<ActiveOutputGraph | null>;
  setMusicPlayback: Dispatch<SetStateAction<MusicPlaybackState>>;
  setSpeakerTestSettings: Dispatch<SetStateAction<SpeakerTestSettings>>;
  stopMusicOutputGraph: () => void;
};

export function useSpeakerTestSettingControls({
  musicOutputGraphRef,
  setMusicPlayback,
  setSpeakerTestSettings,
  stopMusicOutputGraph,
}: UseSpeakerTestSettingControlsOptions) {
  const handleSpeakerTestKindChange = useCallback(
    (kind: SpeakerTestKind) => {
      stopMusicOutputGraph();

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        kind,
        musicQuality:
          kind === 'music'
            ? getDefaultMusicQuality('blindingLights')
            : currentSettings.musicQuality,
        musicSource:
          kind === 'music' ? 'blindingLights' : currentSettings.musicSource,
      }));

      if (kind !== 'music' && kind !== 'dialUp') {
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          durationSeconds: 0,
          isLoading: false,
          isPlaying: false,
          loadingPhase: null,
          loadingProgressPercent: null,
          positionSeconds: 0,
        }));
        return;
      }

      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isLoading: false,
        isPlaying: false,
        loadingPhase: null,
        loadingProgressPercent: null,
        marks: kind === 'dialUp' ? [] : currentPlayback.marks,
        positionSeconds: 0,
      }));
    },
    [setMusicPlayback, setSpeakerTestSettings, stopMusicOutputGraph],
  );

  const handleSpeakerToneFrequencyChange = useCallback(
    (frequency: number) => {
      const nextFrequency = clamp(frequency, 40, 12000);
      const activeGraph = musicOutputGraphRef.current;

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        toneFrequency: nextFrequency,
      }));

      if (
        activeGraph?.mode === 'speakerTest' &&
        activeGraph.updateToneFrequency
      ) {
        activeGraph.updateToneFrequency(nextFrequency);
      }
    },
    [musicOutputGraphRef, setSpeakerTestSettings],
  );

  const handleSpeakerMusicSourceChange = useCallback(
    (musicSource: SpeakerMusicSource) => {
      stopMusicOutputGraph();

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        musicQuality: getDefaultMusicQuality(musicSource),
        musicSource,
      }));
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isLoading: false,
        isPlaying: false,
        loadingPhase: null,
        loadingProgressPercent: null,
        marks: [],
        positionSeconds: 0,
      }));
    },
    [setMusicPlayback, setSpeakerTestSettings, stopMusicOutputGraph],
  );

  const handleSpeakerMusicFileChange = useCallback(
    (musicFile: File | null) => {
      stopMusicOutputGraph();

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        musicFile,
        musicQuality: getDefaultMusicQuality('file'),
        musicSource: musicFile ? 'file' : currentSettings.musicSource,
      }));
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isLoading: false,
        isPlaying: false,
        loadingPhase: null,
        loadingProgressPercent: null,
        marks: [],
        positionSeconds: 0,
      }));
    },
    [setMusicPlayback, setSpeakerTestSettings, stopMusicOutputGraph],
  );

  const handleSpeakerMusicQualityChange = useCallback(
    (musicQuality: SpeakerMusicQuality) => {
      stopMusicOutputGraph();

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        musicQuality,
      }));
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isLoading: false,
        isPlaying: false,
        loadingPhase: null,
        loadingProgressPercent: null,
        positionSeconds: 0,
      }));
    },
    [setMusicPlayback, setSpeakerTestSettings, stopMusicOutputGraph],
  );

  return {
    handleSpeakerMusicFileChange,
    handleSpeakerMusicQualityChange,
    handleSpeakerMusicSourceChange,
    handleSpeakerTestKindChange,
    handleSpeakerToneFrequencyChange,
  };
}
