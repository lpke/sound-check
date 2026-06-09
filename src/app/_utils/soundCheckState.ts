import { revokeRecordedClipUrls } from './recordedClipStorage';
import type {
  FrequencyLevels,
  NamedRecordedClip,
  ProcessingSettings,
  SpeakerTestSettings,
} from './types';

export const defaultProcessingSettings: ProcessingSettings = {
  autoGainControl: true,
  echoCancellation: true,
  noiseSuppression: true,
};

export const defaultSpeakerTestSettings: SpeakerTestSettings = {
  kind: 'tone',
  musicFile: null,
  musicQuality: 'flac',
  musicSource: 'blindingLights',
  toneFrequency: 440,
};

export const DIAL_UP_AUDIO_PATH = '/audio/dial-up.mp3';
export const DIAL_UP_PLAYBACK_GAIN = 3;
export const SPECTRUM_PEAK_DECAY_PER_FRAME = 0.025;

export type MusicMark = {
  id: string;
  seconds: number;
};

export type MusicPlaybackState = {
  durationSeconds: number;
  isLoading: boolean;
  isPlaying: boolean;
  loadingPhase: 'decoding' | 'downloading' | null;
  loadingProgressPercent: number | null;
  marks: MusicMark[];
  positionSeconds: number;
};

export type RecordedPlaybackState = {
  activeClipId: string | null;
  isPlaying: boolean;
  positionsByClipId: Record<string, number>;
};

export type OutputSlot = 'monitor' | 'music' | 'recording';

export function createClipId() {
  return `${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}

export function createInitialMusicPlayback(): MusicPlaybackState {
  return {
    durationSeconds: 0,
    isLoading: false,
    isPlaying: false,
    loadingPhase: null,
    loadingProgressPercent: null,
    marks: [],
    positionSeconds: 0,
  };
}

export function createInitialRecordedPlayback(): RecordedPlaybackState {
  return {
    activeClipId: null,
    isPlaying: false,
    positionsByClipId: {},
  };
}

export function mergeRecordedClips(
  storedClips: NamedRecordedClip[],
  currentClips: NamedRecordedClip[],
) {
  const currentClipIds = new Set(currentClips.map((clip) => clip.id));
  const nextStoredClips = storedClips.filter(
    (clip) => !currentClipIds.has(clip.id),
  );
  const duplicateStoredClips = storedClips.filter((clip) =>
    currentClipIds.has(clip.id),
  );

  revokeRecordedClipUrls(duplicateStoredClips);

  return [...nextStoredClips, ...currentClips].sort(
    (firstClip, secondClip) => firstClip.createdAt - secondClip.createdAt,
  );
}

export function updateFrequencyPeaks(
  currentPeaks: FrequencyLevels,
  nextLevels: FrequencyLevels,
) {
  return nextLevels.map((nextLevel, index) =>
    Math.max(
      nextLevel,
      (currentPeaks[index] ?? 0) - SPECTRUM_PEAK_DECAY_PER_FRAME,
    ),
  );
}
