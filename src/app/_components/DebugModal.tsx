'use client';

import { useMemo, useState } from 'react';
import type { SoundCheckController } from '@/utils/useSoundCheck';
import { getDeviceLabel } from '@/utils/devices';
import { joinClasses } from '@/utils/utils';
import { Modal } from './Modal';

type DebugModalProps = {
  soundCheck: SoundCheckController;
};

type DebugSectionKey =
  | 'app'
  | 'browser'
  | 'devices'
  | 'recording'
  | 'settings'
  | 'status';

type RuntimeInfo = {
  audioContext?: string;
  href?: string;
  isSecureContext?: boolean;
  mediaDevices?: boolean;
  mediaRecorder?: boolean;
  platform?: string;
  setSinkId?: boolean;
  supportedMimeTypes?: string[];
  timestamp?: string;
  userAgent?: string;
  viewport?: string;
};

const debugSections: { key: DebugSectionKey; label: string }[] = [
  { key: 'app', label: 'App state' },
  { key: 'devices', label: 'Devices' },
  { key: 'settings', label: 'Settings' },
  { key: 'recording', label: 'Recording' },
  { key: 'browser', label: 'Browser' },
  { key: 'status', label: 'Status' },
];

const defaultIncludedSections: Record<DebugSectionKey, boolean> = {
  app: true,
  browser: true,
  devices: true,
  recording: true,
  settings: true,
  status: true,
};

const debugMimeTypes = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

export function DebugModal({ soundCheck }: DebugModalProps) {
  const [includedSections, setIncludedSections] = useState(
    defaultIncludedSections,
  );
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const [copyState, setCopyState] = useState<'copied' | 'idle' | 'failed'>(
    'idle',
  );
  const [editedDebugText, setEditedDebugText] = useState<string | null>(null);

  const debugText = useMemo(() => {
    const payload: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      note: 'Sound Check debug snapshot. Device labels can be blank before microphone permission is granted.',
    };

    if (includedSections.app) {
      payload.app = {
        allAudioStopped: soundCheck.allAudioStopped,
        appPaused: soundCheck.appPaused,
        inputMuted: soundCheck.inputMuted,
        inputSignalState: soundCheck.inputSignalState,
        inputLevel: soundCheck.inputLevel,
        monitorDelayMs: soundCheck.monitorDelayMs,
        monitorEnabled: soundCheck.monitorEnabled,
        outputLevel: soundCheck.outputLevel,
        outputMuted: soundCheck.outputMuted,
        outputSignalState: soundCheck.outputSignalState,
        permissionState: soundCheck.permissionState,
        routedMode: soundCheck.routedMode,
      };
    }

    if (includedSections.devices) {
      payload.devices = {
        canRequestOutput: soundCheck.canRequestOutput,
        canRouteOutput: soundCheck.canRouteOutput,
        selectedInput: serializeDeviceSelection({
          devices: soundCheck.inputDevices,
          fallbackName: soundCheck.selectedInputName,
          kind: 'audioinput',
          selectedDeviceId: soundCheck.selectedInputId,
        }),
        selectedOutput: serializeDeviceSelection({
          devices: soundCheck.outputDevices,
          fallbackName: soundCheck.selectedOutputName,
          kind: 'audiooutput',
          selectedDeviceId: soundCheck.selectedOutputId,
        }),
        inputDevices: soundCheck.inputDevices.map((device) => ({
          ...device,
          displayLabel: getDeviceLabel(
            device,
            soundCheck.inputDevices,
            'audioinput',
          ),
        })),
        outputDevices: soundCheck.outputDevices.map((device) => ({
          ...device,
          displayLabel: getDeviceLabel(
            device,
            soundCheck.outputDevices,
            'audiooutput',
          ),
        })),
      };
    }

    if (includedSections.settings) {
      payload.settings = {
        processingEnabled: soundCheck.processingEnabled,
        processingSettings: soundCheck.processingSettings,
        speakerTestSettings: {
          kind: soundCheck.speakerTestSettings.kind,
          musicFile: soundCheck.speakerTestSettings.musicFile
            ? {
                lastModified:
                  soundCheck.speakerTestSettings.musicFile.lastModified,
                name: soundCheck.speakerTestSettings.musicFile.name,
                size: soundCheck.speakerTestSettings.musicFile.size,
                type: soundCheck.speakerTestSettings.musicFile.type,
              }
            : null,
          toneFrequency: soundCheck.speakerTestSettings.toneFrequency,
        },
      };
    }

    if (includedSections.recording) {
      payload.recording = {
        isRecording: soundCheck.isRecording,
        recordedClip: soundCheck.recordedClip
          ? {
              durationSeconds: soundCheck.recordedClip.durationSeconds,
              mimeType: soundCheck.recordedClip.mimeType,
              size: soundCheck.recordedClip.blob.size,
            }
          : null,
        recordingSeconds: soundCheck.recordingSeconds,
      };
    }

    if (includedSections.browser) {
      payload.browser = runtimeInfo;
    }

    if (includedSections.status) {
      payload.status = {
        errorMessage: soundCheck.errorMessage,
        inputStatus: soundCheck.inputStatus,
        outputStatus: soundCheck.outputStatus,
        statusMessage: soundCheck.statusMessage,
      };
    }

    return JSON.stringify(payload, null, 2);
  }, [includedSections, runtimeInfo, soundCheck]);
  const displayedDebugText = editedDebugText ?? debugText;

  async function copyDebugText() {
    try {
      await navigator.clipboard.writeText(displayedDebugText);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <Modal
      title="Audio debug information"
      modalAriaLabel="Audio debug information"
      triggerAriaLabel="Open audio debug information"
      triggerClassName="rounded-lg focus:ring-4 focus:ring-control-soft focus:outline-none"
      trigger={
        <span className="border-line bg-panel hover:bg-panel-soft inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition">
          Debug
        </span>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {debugSections.map((section) => (
            <label
              key={section.key}
              className="border-line bg-panel-soft flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={includedSections[section.key]}
                onChange={(event) => {
                  const checked = event.target.checked;

                  setEditedDebugText(null);
                  setIncludedSections((currentSections) => ({
                    ...currentSections,
                    [section.key]: checked,
                  }));
                }}
                className="accent-control h-4 w-4"
              />
              <span className="text-foreground font-semibold">
                {section.label}
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={copyDebugText}
            className={joinClasses(
              'inline-flex h-10 items-center rounded-lg border px-3 text-sm font-semibold transition focus:ring-4 focus:outline-none',
              copyState === 'copied'
                ? 'border-signal/30 bg-signal-soft text-signal focus:ring-control-soft'
                : copyState === 'failed'
                  ? 'border-danger/30 bg-danger-soft text-danger focus:ring-danger-soft'
                  : 'border-control bg-control text-on-control hover:bg-control-hover focus:ring-control-soft',
            )}
          >
            {copyState === 'copied'
              ? 'Copied'
              : copyState === 'failed'
                ? 'Copy failed'
                : 'Copy JSON'}
          </button>
        </div>

        <textarea
          aria-label="Editable debug information JSON"
          value={displayedDebugText}
          onChange={(event) => setEditedDebugText(event.target.value)}
          spellCheck={false}
          className="border-line bg-panel-soft text-foreground focus:border-control focus:ring-control-soft min-h-[48svh] resize-y rounded-lg border p-4 font-mono text-xs leading-5 outline-none focus:ring-4"
        />
      </div>
    </Modal>
  );
}

function serializeDeviceSelection({
  devices,
  fallbackName,
  kind,
  selectedDeviceId,
}: {
  devices: SoundCheckController['inputDevices'];
  fallbackName: string;
  kind: 'audioinput' | 'audiooutput';
  selectedDeviceId: string;
}) {
  const device = devices.find(
    (candidateDevice) => candidateDevice.deviceId === selectedDeviceId,
  );

  return {
    deviceId: selectedDeviceId,
    displayLabel: device
      ? getDeviceLabel(device, devices, kind)
      : fallbackName || '(none)',
    groupId: device?.groupId,
    kind,
    rawLabel: device?.label,
  };
}

function getRuntimeInfo(): RuntimeInfo {
  if (typeof window === 'undefined') {
    return {};
  }

  return {
    audioContext:
      'AudioContext' in window
        ? 'AudioContext'
        : 'webkitAudioContext' in window
          ? 'webkitAudioContext'
          : undefined,
    href: window.location.href,
    isSecureContext: window.isSecureContext,
    mediaDevices: Boolean(navigator.mediaDevices),
    mediaRecorder: 'MediaRecorder' in window,
    platform: navigator.platform,
    setSinkId:
      typeof HTMLMediaElement !== 'undefined' &&
      'setSinkId' in HTMLMediaElement.prototype,
    supportedMimeTypes:
      'MediaRecorder' in window && MediaRecorder.isTypeSupported
        ? debugMimeTypes.filter((mimeType) =>
            MediaRecorder.isTypeSupported(mimeType),
          )
        : [],
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}
