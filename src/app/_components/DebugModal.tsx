'use client';

import { useMemo, useState, type SVGProps } from 'react';
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
          musicSource: soundCheck.speakerTestSettings.musicSource,
          toneFrequency: soundCheck.speakerTestSettings.toneFrequency,
        },
        musicPlayback: soundCheck.musicPlayback,
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
      triggerClassName="rounded-lg transition active:translate-y-px active:scale-[0.985] focus:outline-none"
      trigger={
        <span className="border-line bg-panel hover:bg-panel-soft inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition select-none">
          Debug
        </span>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {debugSections.map((section) => (
            <label
              key={section.key}
              className="border-line bg-panel-soft flex items-center gap-2 rounded-lg border px-3 py-2 text-sm select-none"
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

        <div className="group/debug-field relative">
          <button
            type="button"
            aria-label="Copy debug JSON"
            title="Copy debug JSON"
            onClick={copyDebugText}
            className={joinClasses(
              'absolute top-2 right-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm opacity-0 transition group-hover/debug-field:opacity-100 focus:opacity-100 focus:outline-none active:translate-y-px active:scale-95',
              copyState === 'copied'
                ? 'border-signal/30 bg-signal-soft text-signal'
                : copyState === 'failed'
                  ? 'border-danger/30 bg-danger-soft text-danger'
                  : 'border-line bg-panel/90 text-muted hover:bg-panel hover:text-foreground',
            )}
          >
            {copyState === 'copied' ? (
              <CheckIcon aria-hidden="true" className="h-4 w-4" />
            ) : (
              <CopyIcon aria-hidden="true" className="h-4 w-4" />
            )}
          </button>

          <textarea
            data-modal-scroll
            aria-label="Editable debug information JSON"
            value={displayedDebugText}
            onChange={(event) => setEditedDebugText(event.target.value)}
            spellCheck={false}
            className="border-line bg-panel-soft text-foreground focus:border-control focus:ring-control-soft h-[50svh] min-h-80 w-full resize-y overflow-auto rounded-lg border p-4 pr-12 font-mono text-xs leading-5 outline-none focus:ring-4"
          />
        </div>
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

function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="M7 6.25V4.5A1.5 1.5 0 0 1 8.5 3h5A1.5 1.5 0 0 1 15 4.5v6A1.5 1.5 0 0 1 13.5 12H12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M5.5 8h5A1.5 1.5 0 0 1 12 9.5v6a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 4 15.5v-6A1.5 1.5 0 0 1 5.5 8Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="m4.5 10.5 3.25 3.25 7.75-8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}
