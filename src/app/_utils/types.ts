import type { Dispatch, SetStateAction } from 'react';

export const DEFAULT_OUTPUT_ID = 'default';
export const MAX_MONITOR_DELAY_MS = 3000;
export const VOICE_THRESHOLD = 0.055;
export const SIGNAL_THRESHOLD = 0.003;
export const HOT_THRESHOLD = 0.55;

export type PermissionState = 'idle' | 'granted' | 'blocked';
export type RoutedMode = 'clip' | 'idle' | 'monitor' | 'speakerTest';
export type StatusTone = 'danger' | 'good' | 'idle' | 'warn';
export type SectionSignalState = 'active' | 'off' | 'ready';
export type SpeakerTestKind =
  | 'builtInMusic'
  | 'fileMusic'
  | 'modulatedTone'
  | 'sweep'
  | 'tone';

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
  mode: RoutedMode;
  updateDelay?: (seconds: number) => void;
};

export type RecordedClip = {
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
  url: string;
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
};

export type LevelSetter = Dispatch<SetStateAction<number>>;

export type AudioStatus = {
  label: string;
  shortLabel: string;
  tone: StatusTone;
};
