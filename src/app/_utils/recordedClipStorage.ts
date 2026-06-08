import type { NamedRecordedClip } from './types';

const RECORDED_CLIPS_STORAGE_KEY = 'sound-check:recorded-clips:v1';
const RECORDED_CLIPS_STORAGE_VERSION = 1;

type StoredRecordedClip = {
  createdAt: number;
  dataUrl: string;
  durationSeconds: number;
  id: string;
  inputDeviceId: string;
  inputDeviceName: string;
  mimeType: string;
  name: string;
};

type StoredRecordedClipsPayload = {
  clips: StoredRecordedClip[];
  version: typeof RECORDED_CLIPS_STORAGE_VERSION;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredRecordedClip(value: unknown): value is StoredRecordedClip {
  return (
    isRecord(value) &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    typeof value.dataUrl === 'string' &&
    typeof value.durationSeconds === 'number' &&
    Number.isFinite(value.durationSeconds) &&
    typeof value.id === 'string' &&
    typeof value.inputDeviceId === 'string' &&
    typeof value.inputDeviceName === 'string' &&
    typeof value.mimeType === 'string' &&
    typeof value.name === 'string'
  );
}

function isStoredRecordedClipsPayload(
  value: unknown,
): value is StoredRecordedClipsPayload {
  return (
    isRecord(value) &&
    value.version === RECORDED_CLIPS_STORAGE_VERSION &&
    Array.isArray(value.clips) &&
    value.clips.every(isStoredRecordedClip)
  );
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(reader.error ?? new Error('Recording could not be read.'));
    };
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Recording could not be encoded.'));
    };

    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string, mimeType: string) {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error('Stored recording could not be read.');
  }

  const blob = await response.blob();

  if (blob.type || !mimeType) {
    return blob;
  }

  return new Blob([await blob.arrayBuffer()], { type: mimeType });
}

async function toStoredRecordedClip(
  clip: NamedRecordedClip,
): Promise<StoredRecordedClip> {
  return {
    createdAt: clip.createdAt,
    dataUrl: await readBlobAsDataUrl(clip.blob),
    durationSeconds: clip.durationSeconds,
    id: clip.id,
    inputDeviceId: clip.inputDeviceId,
    inputDeviceName: clip.inputDeviceName,
    mimeType: clip.mimeType,
    name: clip.name,
  };
}

async function toNamedRecordedClip(
  storedClip: StoredRecordedClip,
): Promise<NamedRecordedClip | null> {
  try {
    const blob = await dataUrlToBlob(storedClip.dataUrl, storedClip.mimeType);

    return {
      blob,
      createdAt: storedClip.createdAt,
      durationSeconds: storedClip.durationSeconds,
      id: storedClip.id,
      inputDeviceId: storedClip.inputDeviceId,
      inputDeviceName: storedClip.inputDeviceName,
      mimeType: storedClip.mimeType || blob.type || 'audio/webm',
      name: storedClip.name,
      url: URL.createObjectURL(blob),
    };
  } catch {
    return null;
  }
}

export async function createRecordedClipStorageSnapshot(
  clips: NamedRecordedClip[],
) {
  if (clips.length === 0) {
    return null;
  }

  const payload: StoredRecordedClipsPayload = {
    clips: await Promise.all(clips.map(toStoredRecordedClip)),
    version: RECORDED_CLIPS_STORAGE_VERSION,
  };

  return JSON.stringify(payload);
}

export async function loadRecordedClipsFromStorage() {
  if (typeof window === 'undefined') {
    return [];
  }

  const storedValue = window.localStorage.getItem(RECORDED_CLIPS_STORAGE_KEY);

  if (!storedValue) {
    return [];
  }

  const parsedValue: unknown = JSON.parse(storedValue);

  if (!isStoredRecordedClipsPayload(parsedValue)) {
    return [];
  }

  const clips = await Promise.all(
    parsedValue.clips.map((storedClip) => toNamedRecordedClip(storedClip)),
  );

  return clips.filter((clip): clip is NamedRecordedClip => clip !== null);
}

export function revokeRecordedClipUrls(
  clips: Pick<NamedRecordedClip, 'url'>[],
) {
  clips.forEach((clip) => URL.revokeObjectURL(clip.url));
}

export function writeRecordedClipStorageSnapshot(snapshot: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (snapshot === null) {
    window.localStorage.removeItem(RECORDED_CLIPS_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(RECORDED_CLIPS_STORAGE_KEY, snapshot);
}
