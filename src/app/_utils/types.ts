import type { Dispatch, SetStateAction } from 'react';

export const DEFAULT_OUTPUT_ID = 'default';
export const MAX_MONITOR_DELAY_MS = 3000;
export const VOICE_THRESHOLD = 0.18;
export const SIGNAL_THRESHOLD = 0.003;
export const HOT_THRESHOLD = 0.9;

export type PermissionState = 'idle' | 'granted' | 'blocked';
export type RoutedMode = 'clip' | 'idle' | 'monitor' | 'speakerTest';
export type StatusTone = 'danger' | 'good' | 'idle' | 'warn';
export type SectionSignalState = 'active' | 'off' | 'ready';
export type SpeakerTestKind = 'modulatedTone' | 'music' | 'sweep' | 'tone';
export type SpeakerMusicTrackId = 'blindingLights' | 'evilManBlues';
export type SpeakerMusicSource = SpeakerMusicTrackId | 'file';

export type AudioDevice = Pick<
  MediaDeviceInfo,
  'deviceId' | 'groupId' | 'kind' | 'label'
>;

export type SinkAudioElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export type MediaDevicesWithOutputPicker = MediaDevices & {
  selectAudioOutput?: () => Promise<MediaDeviceInfo>;
};

export type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export type ActiveInputAnalyser = {
  cancel: () => void;
  context: AudioContext;
  stream: MediaStream;
};

export type ActiveOutputGraph = {
  cancel: () => void;
  context: AudioContext;
  durationSeconds?: number;
  getCurrentTime?: () => number;
  isPaused?: () => boolean;
  mode: RoutedMode;
  pause?: () => void;
  playFrom?: (offsetSeconds: number) => void;
  updateDelay?: (seconds: number) => void;
  updateToneFrequency?: (frequency: number) => void;
};

export type RecordedClip = {
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
  url: string;
};

export type NamedRecordedClip = RecordedClip & {
  id: string;
  inputDeviceId: string;
  inputDeviceName: string;
  name: string;
  createdAt: number;
};

export type ProcessingSettings = {
  autoGainControl: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
};

export type ProcessingSettingKey = keyof ProcessingSettings;

export type SpeakerTestSettings = {
  kind: SpeakerTestKind;
  toneFrequency: number;
  musicFile: File | null;
  musicSource: SpeakerMusicSource;
};

export type FrequencyLevels = number[];

export type LevelSetter = Dispatch<SetStateAction<number>>;
export type FrequencyLevelSetter = (levels: FrequencyLevels) => void;

export type AudioStatus = {
  label: string;
  shortLabel: string;
  tone: StatusTone;
};
