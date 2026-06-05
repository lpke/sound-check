import {
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from 'react';
import type { SoundCheckController } from '@/utils/useSoundCheck';
import { getDeviceLabel } from '@/utils/devices';
import {
  MAX_MONITOR_DELAY_MS,
  type AudioDevice,
  type SectionSignalState,
  type SpeakerTestKind,
} from '@/utils/types';
import { formatSeconds, joinClasses } from '@/utils/utils';
import { DebugModal } from './DebugModal';
import { Button, Field, LevelMeter, Panel } from './ui';

type SoundCheckProps = {
  soundCheck: SoundCheckController;
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const speakerTestOptions: { kind: SpeakerTestKind; label: string }[] = [
  { kind: 'tone', label: 'Steady tone' },
  { kind: 'modulatedTone', label: 'Modulating tone' },
  { kind: 'sweep', label: 'Frequency sweep' },
  { kind: 'builtInMusic', label: 'Built-in music' },
  { kind: 'fileMusic', label: 'Music file' },
];

export function SiteHeader({ soundCheck }: SoundCheckProps) {
  return (
    <header className="flex justify-end gap-2">
      <DebugModal soundCheck={soundCheck} />
      <button
        type="button"
        onClick={soundCheck.toggleAllAudio}
        className={joinClasses(
          'inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition focus:ring-4 focus:outline-none',
          soundCheck.allAudioStopped
            ? 'border-control bg-control text-on-control hover:bg-control-hover focus:ring-control-soft'
            : 'border-line bg-panel text-foreground hover:bg-panel-soft focus:ring-control-soft',
        )}
      >
        {soundCheck.allAudioStopped ? (
          <PlayIcon aria-hidden="true" className="h-4 w-4" />
        ) : (
          <PauseIcon aria-hidden="true" className="h-4 w-4" />
        )}
        {soundCheck.allAudioStopped ? 'Resume all' : 'Pause all'}
      </button>
    </header>
  );
}

export function UnsupportedPanel() {
  return (
    <Panel title="Browser support">
      <p className="text-danger text-sm">
        This browser does not expose the media device APIs required for audio
        testing.
      </p>
    </Panel>
  );
}

export function InputSection({ soundCheck }: SoundCheckProps) {
  const isInputStopped = soundCheck.appPaused || soundCheck.inputMuted;

  return (
    <SectionShell muted={isInputStopped}>
      <SectionHeader
        accent="input"
        devices={soundCheck.inputDevices}
        deviceKind="audioinput"
        emptyLabel="No microphone detected"
        icon={MicrophoneIcon}
        muted={isInputStopped}
        onDeviceChange={soundCheck.handleInputChange}
        onRefresh={soundCheck.refreshDevices}
        onToggleMute={soundCheck.toggleInputMute}
        selectedDeviceId={soundCheck.selectedInputId}
        selectedDeviceName={soundCheck.selectedInputName}
        selectLabel="Microphone device"
        signalState={soundCheck.inputSignalState}
        toggleLabel={isInputStopped ? 'Unmute microphone' : 'Mute microphone'}
      />
      <LevelMeter accent="input" level={soundCheck.inputLevel} />

      <div className="grid gap-4 p-4 sm:p-5">
        <ProcessingBlock soundCheck={soundCheck} />
        <LiveMonitorBlock soundCheck={soundCheck} />
        <RecordingCapture soundCheck={soundCheck} />
      </div>
    </SectionShell>
  );
}

export function OutputSection({ soundCheck }: SoundCheckProps) {
  const musicFileInputRef = useRef<HTMLInputElement | null>(null);
  const isOutputStopped = soundCheck.appPaused || soundCheck.outputMuted;
  const testKind = soundCheck.speakerTestSettings.kind;
  const needsFrequency = usesToneFrequency(testKind);
  const needsFile = testKind === 'fileMusic';
  const isSpeakerTestActive = soundCheck.routedMode === 'speakerTest';
  const isOutputBusy =
    soundCheck.routedMode !== 'idle' && soundCheck.routedMode !== 'speakerTest';

  function handleSpeakerTestKindChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextKind = event.target.value as SpeakerTestKind;

    soundCheck.handleSpeakerTestKindChange(nextKind);

    if (nextKind === 'fileMusic') {
      window.setTimeout(() => musicFileInputRef.current?.click(), 0);
    }
  }

  return (
    <SectionShell muted={isOutputStopped}>
      <SectionHeader
        accent="output"
        devices={soundCheck.outputDevices}
        deviceKind="audiooutput"
        disabled={!soundCheck.canRouteOutput}
        emptyLabel="No speaker detected"
        icon={SpeakerIcon}
        muted={isOutputStopped}
        onDeviceChange={soundCheck.handleOutputChange}
        onRefresh={soundCheck.refreshDevices}
        onToggleMute={soundCheck.toggleOutputMute}
        selectedDeviceId={soundCheck.selectedOutputId}
        selectedDeviceName={soundCheck.selectedOutputName}
        selectLabel="Speaker device"
        signalState={soundCheck.outputSignalState}
        toggleLabel={isOutputStopped ? 'Unmute speaker' : 'Mute speaker'}
      />
      <LevelMeter accent="output" level={soundCheck.outputLevel} />

      <div className="grid gap-4 p-4 sm:p-5">
        {soundCheck.canRequestOutput ? (
          <SettingsGroup
            title="Output access"
            description="Ask the browser for additional speaker choices when it supports explicit output selection."
          >
            <Button
              variant="outputSecondary"
              onClick={soundCheck.requestOutputAccess}
            >
              Choose speaker
            </Button>
          </SettingsGroup>
        ) : null}

        <SettingsGroup
          title="Speaker test"
          description="Generated tones are routed directly to the selected output. Music playback is decoded only when you play it."
        >
          <div className="grid gap-4">
            <Field label="Sound">
              <select
                id="speaker-test-kind"
                name="speaker-test-kind"
                value={testKind}
                onChange={handleSpeakerTestKindChange}
                className="border-line bg-panel text-foreground focus:border-control focus:ring-control-soft h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-4"
              >
                {speakerTestOptions.map((option) => (
                  <option key={option.kind} value={option.kind}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {needsFrequency ? (
              <div className="grid gap-2">
                <Field
                  label={`Tone frequency: ${soundCheck.speakerTestSettings.toneFrequency} Hz`}
                >
                  <input
                    id="speaker-test-frequency"
                    name="speaker-test-frequency"
                    type="range"
                    min={40}
                    max={12000}
                    step={10}
                    value={soundCheck.speakerTestSettings.toneFrequency}
                    onChange={(event) =>
                      soundCheck.handleSpeakerToneFrequencyChange(
                        Number(event.target.value),
                      )
                    }
                    className="accent-control h-11 w-full"
                  />
                </Field>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    aria-label="Tone frequency in hertz"
                    type="number"
                    min={40}
                    max={12000}
                    step={10}
                    value={soundCheck.speakerTestSettings.toneFrequency}
                    onChange={(event) =>
                      soundCheck.handleSpeakerToneFrequencyChange(
                        Number(event.target.value),
                      )
                    }
                    className="border-line bg-panel text-foreground focus:border-control focus:ring-control-soft h-11 rounded-lg border px-3 font-mono text-sm transition outline-none focus:ring-4"
                  />
                  <span className="border-line bg-panel-soft text-muted flex h-11 items-center rounded-lg border px-3 text-sm">
                    Hz
                  </span>
                </div>
              </div>
            ) : null}

            <input
              ref={musicFileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) =>
                soundCheck.handleSpeakerMusicFileChange(
                  event.target.files?.item(0) ?? null,
                )
              }
            />

            {needsFile ? (
              <div className="border-line bg-panel flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-foreground truncate text-sm font-semibold">
                  {soundCheck.speakerTestSettings.musicFile?.name ??
                    'No file selected'}
                </p>
                <Button
                  variant="outputSecondary"
                  onClick={() => musicFileInputRef.current?.click()}
                >
                  Choose file
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outputPrimary"
                onClick={soundCheck.startSpeakerTest}
                disabled={
                  soundCheck.appPaused ||
                  soundCheck.outputMuted ||
                  isOutputBusy ||
                  (needsFile && !soundCheck.speakerTestSettings.musicFile)
                }
              >
                Play test sound
              </Button>
              {isSpeakerTestActive && !soundCheck.appPaused ? (
                <Button
                  variant="outputSecondary"
                  onClick={soundCheck.stopOutputGraph}
                >
                  Stop
                </Button>
              ) : null}
            </div>
          </div>
        </SettingsGroup>

        <RecordingPlayback soundCheck={soundCheck} />
      </div>
    </SectionShell>
  );
}

function SectionShell({
  children,
  muted,
}: {
  children: ReactNode;
  muted: boolean;
}) {
  return (
    <section className="border-line bg-panel relative overflow-hidden rounded-lg border shadow-sm">
      {children}
      {muted ? (
        <div className="pointer-events-none absolute inset-0 z-20 bg-slate-200/35 backdrop-grayscale" />
      ) : null}
    </section>
  );
}

function SectionHeader({
  accent,
  devices,
  deviceKind,
  disabled,
  emptyLabel,
  icon: Icon,
  muted,
  onDeviceChange,
  onRefresh,
  onToggleMute,
  selectedDeviceId,
  selectedDeviceName,
  selectLabel,
  signalState,
  toggleLabel,
}: {
  accent: 'input' | 'output';
  devices: AudioDevice[];
  deviceKind: 'audioinput' | 'audiooutput';
  disabled?: boolean;
  emptyLabel: string;
  icon: IconComponent;
  muted: boolean;
  onDeviceChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onRefresh: () => void;
  onToggleMute: () => void;
  selectedDeviceId: string;
  selectedDeviceName: string;
  selectLabel: string;
  signalState: SectionSignalState;
  toggleLabel: string;
}) {
  const canChangeDevice = !disabled && devices.length > 0;
  const visibleDeviceName = selectedDeviceName || emptyLabel;

  return (
    <div
      className={joinClasses(
        'border-line grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 border-b px-4 py-4 sm:px-5',
        accent === 'input' && 'bg-input-soft',
        accent === 'output' && 'bg-output-soft',
      )}
    >
      <button
        type="button"
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={onToggleMute}
        className={joinClasses(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-white transition focus:ring-4 focus:outline-none',
          muted
            ? 'border-line bg-muted/55 focus:ring-panel-strong'
            : accent === 'input'
              ? 'border-input bg-input hover:bg-input/90 focus:ring-input-soft'
              : 'border-output bg-output hover:bg-output/90 focus:ring-output-soft',
        )}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </button>

      <label className="focus-within:ring-control-soft relative inline-flex max-w-full min-w-44 items-center justify-self-start rounded-md py-1 pr-7 text-left transition focus-within:ring-4">
        <span className="sr-only">{selectLabel}</span>
        <span
          className="text-foreground min-w-0 truncate text-lg leading-tight font-semibold sm:text-xl"
          title={visibleDeviceName}
        >
          {visibleDeviceName}
        </span>
        {canChangeDevice ? (
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted pointer-events-none ml-1.5 h-4 w-4 shrink-0"
          />
        ) : null}
        <select
          aria-label={selectLabel}
          disabled={!canChangeDevice}
          title={visibleDeviceName}
          value={selectedDeviceId}
          onChange={onDeviceChange}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
        >
          {devices.length === 0 ? (
            <option value="">{emptyLabel}</option>
          ) : (
            devices.map((device, index) => (
              <option
                key={`${device.deviceId}-${index}`}
                value={device.deviceId}
              >
                {getDeviceLabel(device, devices, deviceKind)}
              </option>
            ))
          )}
        </select>
      </label>

      <RefreshButton
        label="Refresh devices"
        onClick={onRefresh}
        icon={RefreshIcon}
      />
      <SignalDot state={signalState} />
    </div>
  );
}

function SignalDot({ state }: { state: SectionSignalState }) {
  const label =
    state === 'off' ? 'Off' : state === 'ready' ? 'Ready' : 'Signal detected';

  return (
    <span
      aria-label={label}
      title={label}
      className={joinClasses(
        'h-3.5 w-3.5 rounded-full border',
        state === 'off' && 'border-line bg-muted/35',
        state === 'ready' && 'border-status-ready bg-status-ready',
        state === 'active' &&
          'border-status-active bg-status-active shadow-[0_0_0_5px_rgba(36,100,194,0.22)]',
      )}
    />
  );
}

function ProcessingBlock({ soundCheck }: SoundCheckProps) {
  return (
    <SettingsGroup
      title="Capture processing"
      description="Off gives the raw microphone stream for monitoring and recording. Enable these browser controls only when you want the call-style processed signal."
    >
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="text-foreground text-sm font-semibold">
          Enable processing
        </span>
        <input
          id="processing-enabled"
          name="processing-enabled"
          type="checkbox"
          checked={soundCheck.processingEnabled}
          onChange={(event) =>
            soundCheck.handleProcessingEnabledChange(event.target.checked)
          }
          className="accent-control h-5 w-5 shrink-0"
        />
      </label>

      <div className="border-line mt-3 grid gap-3 border-t pt-3">
        <ProcessingOption
          checked={soundCheck.processingSettings.echoCancellation}
          disabled={!soundCheck.processingEnabled}
          label="Echo cancellation"
          description="Reduces speaker feedback and room echo before this app receives the mic."
          onChange={(checked) =>
            soundCheck.handleProcessingSettingChange(
              'echoCancellation',
              checked,
            )
          }
        />
        <ProcessingOption
          checked={soundCheck.processingSettings.noiseSuppression}
          disabled={!soundCheck.processingEnabled}
          label="Noise suppression"
          description="Filters steady background noise before monitoring or recording."
          onChange={(checked) =>
            soundCheck.handleProcessingSettingChange(
              'noiseSuppression',
              checked,
            )
          }
        />
        <ProcessingOption
          checked={soundCheck.processingSettings.autoGainControl}
          disabled={!soundCheck.processingEnabled}
          label="Auto gain"
          description="Lets the browser raise or lower microphone volume automatically."
          onChange={(checked) =>
            soundCheck.handleProcessingSettingChange('autoGainControl', checked)
          }
        />
      </div>
    </SettingsGroup>
  );
}

function ProcessingOption({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-control mt-1 h-4 w-4 shrink-0"
      />
      <span>
        <span className="text-foreground block text-sm font-semibold">
          {label}
        </span>
        <span className="text-muted mt-0.5 block text-xs leading-5">
          {description}
        </span>
      </span>
    </label>
  );
}

function LiveMonitorBlock({ soundCheck }: SoundCheckProps) {
  return (
    <SettingsGroup title="Live monitor">
      <div className="grid gap-4">
        <Field label={`Delay: ${soundCheck.monitorDelayMs} ms`}>
          <input
            id="monitor-delay"
            name="monitor-delay"
            type="range"
            min={0}
            max={MAX_MONITOR_DELAY_MS}
            step={100}
            value={soundCheck.monitorDelayMs}
            onChange={(event) =>
              soundCheck.handleDelayChange(Number(event.target.value))
            }
            className="accent-control h-11 w-full"
          />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            id="monitor-delay-ms"
            name="monitor-delay-ms"
            aria-label="Monitor delay in milliseconds"
            type="number"
            min={0}
            max={MAX_MONITOR_DELAY_MS}
            step={100}
            value={soundCheck.monitorDelayMs}
            onChange={(event) =>
              soundCheck.handleDelayChange(Number(event.target.value))
            }
            className="border-line bg-panel text-foreground focus:border-control focus:ring-control-soft h-11 rounded-lg border px-3 font-mono text-sm transition outline-none focus:ring-4"
          />
          <span className="border-line bg-panel text-muted flex h-11 items-center rounded-lg border px-3 text-sm">
            ms
          </span>
        </div>
        {soundCheck.monitorEnabled ? (
          <Button variant="secondary" onClick={soundCheck.stopMonitor}>
            Stop monitor
          </Button>
        ) : (
          <Button
            disabled={
              soundCheck.appPaused ||
              soundCheck.inputMuted ||
              soundCheck.outputMuted
            }
            onClick={soundCheck.startMonitor}
          >
            Start monitor
          </Button>
        )}
      </div>
    </SettingsGroup>
  );
}

function RecordingCapture({ soundCheck }: SoundCheckProps) {
  return (
    <SettingsGroup title="Record input">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted font-mono text-xs">
          {soundCheck.isRecording
            ? formatSeconds(soundCheck.recordingSeconds)
            : soundCheck.recordedClip
              ? formatSeconds(soundCheck.recordedClip.durationSeconds)
              : '00:00.0'}
        </p>

        {soundCheck.isRecording ? (
          <Button variant="danger" onClick={soundCheck.stopRecording}>
            Stop recording
          </Button>
        ) : (
          <Button
            disabled={soundCheck.appPaused || soundCheck.inputMuted}
            onClick={soundCheck.startRecording}
          >
            Record input
          </Button>
        )}
      </div>
    </SettingsGroup>
  );
}

function RecordingPlayback({ soundCheck }: SoundCheckProps) {
  return (
    <SettingsGroup
      title="Recorded playback"
      description={
        soundCheck.recordedClip
          ? `${soundCheck.recordedClip.mimeType || 'audio'} clip ready.`
          : 'No clip recorded.'
      }
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outputSecondary"
          onClick={soundCheck.playRecordedClip}
          disabled={
            soundCheck.appPaused ||
            soundCheck.outputMuted ||
            !soundCheck.recordedClip ||
            soundCheck.routedMode === 'clip'
          }
        >
          Play recording
        </Button>
        {soundCheck.routedMode === 'clip' ? (
          <Button
            variant="outputSecondary"
            onClick={soundCheck.stopOutputGraph}
          >
            Stop
          </Button>
        ) : null}
      </div>
    </SettingsGroup>
  );
}

function SettingsGroup({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <section className="border-line bg-panel-soft rounded-lg border p-4">
      <div className="mb-4">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-muted mt-1 text-xs leading-5">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RefreshButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  onClick: () => Promise<void> | void;
}) {
  const [isSpinning, setIsSpinning] = useState(false);

  async function handleClick() {
    setIsSpinning(true);

    try {
      await onClick();
    } finally {
      window.setTimeout(() => setIsSpinning(false), 500);
    }
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleClick}
      className="text-muted hover:bg-panel/80 hover:text-foreground focus:ring-control-soft flex h-9 w-9 items-center justify-center rounded-lg bg-transparent transition focus:ring-4 focus:outline-none"
    >
      <Icon
        aria-hidden="true"
        className={joinClasses('h-4 w-4', isSpinning && 'animate-spin')}
      />
    </button>
  );
}

function usesToneFrequency(kind: SpeakerTestKind) {
  return kind === 'tone' || kind === 'modulatedTone' || kind === 'sweep';
}

function MicrophoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 3.75a3 3 0 0 0-3 3v5a3 3 0 1 0 6 0v-5a3 3 0 0 0-3-3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M5.75 11.25a6.25 6.25 0 0 0 12.5 0M12 17.5v2.75M8.75 20.25h6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SpeakerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4.75 9.25v5.5h3.1l4.65 3.5V5.75l-4.65 3.5h-3.1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M16 8.5a5.15 5.15 0 0 1 0 7M18.5 6.25a8.4 8.4 0 0 1 0 11.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="m5 7.5 5 5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M20 6v5h-5M4 18v-5h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M18.1 10A6.5 6.5 0 0 0 6.6 7.2L4 10m1.9 4A6.5 6.5 0 0 0 17.4 16.8L20 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PauseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="M7 4.75v10.5M13 4.75v10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="M7 4.75v10.5l8-5.25L7 4.75Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
