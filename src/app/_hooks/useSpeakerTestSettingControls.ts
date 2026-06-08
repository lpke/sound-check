import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from 'react';
import type { MusicPlaybackState } from '@/utils/soundCheckState';
import type {
  ActiveOutputGraph,
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
      if (musicOutputGraphRef.current?.mode === 'speakerTest') {
        stopMusicOutputGraph();
      }

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        kind,
      }));

      if (kind !== 'music' && kind !== 'dialUp') {
        setMusicPlayback((currentPlayback) => ({
          ...currentPlayback,
          durationSeconds: 0,
          isLoading: false,
          isPlaying: false,
          positionSeconds: 0,
        }));
        return;
      }

      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isLoading: false,
        isPlaying: false,
        marks: kind === 'dialUp' ? [] : currentPlayback.marks,
        positionSeconds: 0,
      }));
    },
    [
      musicOutputGraphRef,
      setMusicPlayback,
      setSpeakerTestSettings,
      stopMusicOutputGraph,
    ],
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
      if (musicOutputGraphRef.current?.mode === 'speakerTest') {
        stopMusicOutputGraph();
      }

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        musicSource,
      }));
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isLoading: false,
        isPlaying: false,
        marks: [],
        positionSeconds: 0,
      }));
    },
    [
      musicOutputGraphRef,
      setMusicPlayback,
      setSpeakerTestSettings,
      stopMusicOutputGraph,
    ],
  );

  const handleSpeakerMusicFileChange = useCallback(
    (musicFile: File | null) => {
      if (musicOutputGraphRef.current?.mode === 'speakerTest') {
        stopMusicOutputGraph();
      }

      setSpeakerTestSettings((currentSettings) => ({
        ...currentSettings,
        musicFile,
        musicSource: musicFile ? 'file' : currentSettings.musicSource,
      }));
      setMusicPlayback((currentPlayback) => ({
        ...currentPlayback,
        durationSeconds: 0,
        isLoading: false,
        isPlaying: false,
        marks: [],
        positionSeconds: 0,
      }));
    },
    [
      musicOutputGraphRef,
      setMusicPlayback,
      setSpeakerTestSettings,
      stopMusicOutputGraph,
    ],
  );

  return {
    handleSpeakerMusicFileChange,
    handleSpeakerMusicSourceChange,
    handleSpeakerTestKindChange,
    handleSpeakerToneFrequencyChange,
  };
}
