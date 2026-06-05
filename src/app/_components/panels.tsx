import {
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
  type RefObject,
  type SVGProps,
} from 'react';
import type { SoundCheckController } from '@/utils/useSoundCheck';
import { getDeviceLabel } from '@/utils/devices';
import {
  MAX_MONITOR_DELAY_MS,
  type AudioDevice,
  type SectionSignalState,
  type SpeakerMusicSource,
  type SpeakerTestKind,
} from '@/utils/types';
import { clamp, formatSeconds, joinClasses } from '@/utils/utils';
import { DebugModal } from './DebugModal';
import { Button, Field, LevelMeter, Panel } from './ui';

const LOG_SCALE_POWER = 1.2;

type SoundCheckProps = {
  soundCheck: SoundCheckController;
};

type SiteFooterProps = {
  soundCheck: SoundCheckController;
  onRecheckPermission?: () => void;
};

type SectionAccent = 'input' | 'output';
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const speakerTestOptions: { kind: SpeakerTestKind; label: string }[] = [
  { kind: 'tone', label: 'Steady tone' },
  { kind: 'modulatedTone', label: 'Modulating tone' },
  { kind: 'sweep', label: 'Frequency sweep' },
  { kind: 'music', label: 'Music' },
];

export function SiteFooter({
  soundCheck,
  onRecheckPermission,
}: SiteFooterProps) {
  return (
    <footer className="mt-2 flex items-center justify-between gap-2 pb-1">
      <div className="flex-1">
        {onRecheckPermission ? (
          <button
            type="button"
            onClick={onRecheckPermission}
            className="text-muted/70 hover:text-muted text-sm underline underline-offset-2 transition focus:outline-none"
          >
            Recheck permission and refresh devices
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2">
        <DebugModal soundCheck={soundCheck} />
        <button
          type="button"
          onClick={soundCheck.toggleAllAudio}
          className={joinClasses(
            'inline-flex h-10 w-28 items-center justify-center rounded-lg border px-3 text-sm font-semibold whitespace-nowrap transition focus:outline-none active:translate-y-px active:scale-[0.985]',
            soundCheck.allAudioStopped
              ? 'border-control bg-control text-on-control hover:bg-control-hover'
              : 'border-line bg-panel text-foreground hover:bg-panel-soft',
          )}
        >
          {soundCheck.allAudioStopped ? 'Resume all' : 'Pause all'}
        </button>
      </div>
    </footer>
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
  const isSpeakerTestActive = soundCheck.routedMode === 'speakerTest';
  const isToneTestPlaying = isSpeakerTestActive;

  function handleSpeakerTestKindChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextKind = event.target.value as SpeakerTestKind;

    soundCheck.handleSpeakerTestKindChange(nextKind);
  }

  function handleMusicSourceChange(event: ChangeEvent<HTMLSelectElement>) {
    const musicSource = event.target.value as SpeakerMusicSource;

    soundCheck.handleSpeakerMusicSourceChange(musicSource);

    if (musicSource === 'file' && !soundCheck.speakerTestSettings.musicFile) {
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

        <SettingsGroup title="Speaker test">
          <div className="grid gap-4">
            <Field label="Sound">
              <div className="relative">
                <select
                  id="speaker-test-kind"
                  name="speaker-test-kind"
                  value={testKind}
                  onChange={handleSpeakerTestKindChange}
                  className={joinClasses(
                    controlClassName('output'),
                    'appearance-none pr-9',
                  )}
                >
                  {speakerTestOptions.map((option) => (
                    <option key={option.kind} value={option.kind}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="text-muted pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2"
                />
              </div>
            </Field>

            {needsFrequency ? (
              <RangeWithUnit
                accent="output"
                ariaLabel="Tone frequency in hertz"
                idBase="speaker-test-frequency"
                label="Tone frequency"
                max={12000}
                min={40}
                step={10}
                scaleMode="log"
                showLabel={false}
                unit="Hz"
                value={soundCheck.speakerTestSettings.toneFrequency}
                onChange={(nextValue) =>
                  soundCheck.handleSpeakerToneFrequencyChange(nextValue)
                }
              />
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

            {testKind === 'music' ? (
              <MusicConfig
                musicFileInputRef={musicFileInputRef}
                onMusicSourceChange={handleMusicSourceChange}
                soundCheck={soundCheck}
              />
            ) : null}

            {testKind !== 'music' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant={isToneTestPlaying ? 'danger' : 'outputPrimary'}
                  onClick={
                    isToneTestPlaying
                      ? soundCheck.stopPlaybackOutput
                      : soundCheck.startSpeakerTest
                  }
                  disabled={soundCheck.appPaused || soundCheck.outputMuted}
                  className="w-40"
                >
                  {isToneTestPlaying ? 'Stop test sound' : 'Play test sound'}
                </Button>
              </div>
            ) : null}
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
    <section className="border-line bg-panel relative overflow-hidden rounded-lg border shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
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
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-white transition focus:outline-none active:translate-y-px active:scale-95',
          muted
            ? 'border-line bg-muted/55'
            : accent === 'input'
              ? 'border-input bg-input hover:bg-input/90'
              : 'border-output bg-output hover:bg-output/90',
        )}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </button>

      <label className="relative inline-flex max-w-full min-w-44 items-center justify-self-start py-1 pr-10 text-left">
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
            className="text-muted pointer-events-none mr-2 ml-1.5 h-4 w-4 shrink-0"
          />
        ) : null}
        <select
          id={`${deviceKind}-device`}
          name={`${deviceKind}-device`}
          aria-label={selectLabel}
          disabled={!canChangeDevice}
          title={visibleDeviceName}
          value={selectedDeviceId}
          onChange={onDeviceChange}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 outline-none disabled:cursor-not-allowed"
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
        accent={accent}
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
    <SettingsGroup>
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="text-foreground text-sm font-semibold">
          Enable capture processing
        </span>
        <input
          id="processing-enabled"
          name="processing-enabled"
          type="checkbox"
          checked={soundCheck.processingEnabled}
          onChange={(event) =>
            soundCheck.handleProcessingEnabledChange(event.target.checked)
          }
          className={checkboxClassName('input', 'h-5 w-5 shrink-0')}
        />
      </label>

      <div className="border-line mt-3 grid gap-3 border-t pt-3">
        <ProcessingOption
          checked={soundCheck.processingSettings.echoCancellation}
          disabled={!soundCheck.processingEnabled}
          description="Reduces speaker feedback and room echo before this app receives the mic."
          id="processing-echo-cancellation"
          label="Echo cancellation"
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
          description="Filters steady background noise before monitoring or recording."
          id="processing-noise-suppression"
          label="Noise suppression"
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
          description="Lets the browser raise or lower microphone volume automatically."
          id="processing-auto-gain"
          label="Auto gain"
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
  id,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <input
        id={id}
        name={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className={checkboxClassName('input', 'mt-1 h-4 w-4 shrink-0')}
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
        <RangeWithUnit
          accent="input"
          ariaLabel="Monitor delay in milliseconds"
          idBase="monitor-delay"
          label="Delay"
          max={MAX_MONITOR_DELAY_MS}
          min={0}
          step={100}
          unit="ms"
          value={soundCheck.monitorDelayMs}
          showValueInLabel={false}
          onChange={(nextValue) => soundCheck.handleDelayChange(nextValue)}
        />
        {soundCheck.monitorEnabled ? (
          <Button
            variant="danger"
            onClick={soundCheck.stopMonitor}
            className="mt-2 w-40"
          >
            Stop monitor
          </Button>
        ) : (
          <Button
            className="mt-2 w-40"
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
      <div className="flex flex-wrap items-center justify-between gap-2">
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

        <p className="text-muted font-mono text-xs">
          {soundCheck.isRecording
            ? formatSeconds(soundCheck.recordingSeconds)
            : soundCheck.recordedClip
              ? formatSeconds(soundCheck.recordedClip.durationSeconds)
              : '00:00.0'}
        </p>
      </div>
    </SettingsGroup>
  );
}

function RecordingPlayback({ soundCheck }: SoundCheckProps) {
  return (
    <SettingsGroup title="Recorded playback">
      <div className="grid gap-2">
        {soundCheck.recordedClips.length === 0 ? (
          <p className="text-muted text-sm">No recordings yet.</p>
        ) : (
          soundCheck.recordedClips.map((clip, index) => {
            const isActive =
              soundCheck.recordedPlayback.activeClipId === clip.id;
            const isPlaying = isActive && soundCheck.recordedPlayback.isPlaying;
            const positionSeconds =
              soundCheck.recordedPlayback.positionsByClipId[clip.id] ?? 0;
            const recordingName = clip.name || 'Recording';

            return (
              <div key={clip.id} className="contents">
                <div className="grid gap-3 py-2">
                  <div className="grid gap-2">
                    <input
                      id={`recorded-clip-name-${clip.id}`}
                      name={`recorded-clip-name-${clip.id}`}
                      type="text"
                      value={clip.name}
                      onChange={(event) =>
                        soundCheck.renameRecordedClip(
                          clip.id,
                          event.target.value,
                        )
                      }
                      onFocus={() => soundCheck.selectRecordedClip(clip.id)}
                      onPointerDown={() =>
                        soundCheck.selectRecordedClip(clip.id)
                      }
                      placeholder="Recording"
                      aria-label="Rename recording"
                      title="Rename recording"
                      className="text-foreground focus:border-b-output h-7 min-w-0 border-b border-transparent bg-transparent px-0 text-sm leading-tight transition focus:ring-0 focus:outline-none"
                    />
                    <span
                      className="text-muted block text-xs"
                      title={clip.inputDeviceName}
                    >
                      Device: {clip.inputDeviceName}
                    </span>
                  </div>
                  <AudioPlaybackControls
                    buttonLabel={
                      isPlaying
                        ? `Pause ${recordingName}`
                        : `Play ${recordingName}`
                    }
                    canUseTransport={
                      !soundCheck.appPaused &&
                      !soundCheck.outputMuted &&
                      clip.durationSeconds > 0
                    }
                    durationSeconds={clip.durationSeconds}
                    isPlaying={isPlaying}
                    onSeek={(nextPosition) => {
                      soundCheck.selectRecordedClip(clip.id);
                      soundCheck.handleRecordedClipSeek(clip.id, nextPosition);
                    }}
                    onToggle={() => {
                      soundCheck.selectRecordedClip(clip.id);
                      soundCheck.toggleRecordedClipPlayback(clip.id);
                    }}
                    positionSeconds={positionSeconds}
                    seekLabel={`${recordingName} playback position`}
                    seekName={`recorded-clip-position-${clip.id}`}
                  />
                </div>
                {index < soundCheck.recordedClips.length - 1 ? (
                  <hr className="border-line -mx-1 mt-2 border-t" />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </SettingsGroup>
  );
}

function AudioPlaybackControls({
  buttonLabel,
  canUseTransport,
  children,
  durationSeconds,
  isPlaying,
  onSeek,
  onToggle,
  positionSeconds,
  seekLabel,
  seekName,
}: {
  buttonLabel: string;
  canUseTransport: boolean;
  children?: ReactNode;
  durationSeconds: number;
  isPlaying: boolean;
  onSeek: (positionSeconds: number) => void;
  onToggle: () => void;
  positionSeconds: number;
  seekLabel: string;
  seekName: string;
}) {
  const hasDuration = durationSeconds > 0;
  const boundedPosition = hasDuration
    ? clamp(positionSeconds, 0, durationSeconds)
    : 0;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6">
      <button
        type="button"
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={onToggle}
        disabled={!canUseTransport}
        className={joinClasses(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition focus:outline-none active:translate-y-px active:scale-95 disabled:opacity-45 disabled:active:translate-y-0 disabled:active:scale-100',
          isPlaying ? 'bg-danger text-white' : 'bg-output text-on-control',
        )}
      >
        {isPlaying ? (
          <PauseIcon aria-hidden="true" className="h-5 w-5" />
        ) : (
          <PlayIcon aria-hidden="true" className="h-5 w-5 translate-x-px" />
        )}
      </button>

      <div className="grid min-w-0 gap-0">
        {children}
        <div className="grid gap-0">
          <input
            id={seekName}
            name={seekName}
            aria-label={seekLabel}
            type="range"
            min={0}
            max={durationSeconds || 1}
            step={0.05}
            value={boundedPosition}
            disabled={!hasDuration}
            onChange={(event) => onSeek(Number(event.target.value))}
            className={joinClasses(rangeClassName('output'), '-mb-2')}
          />
          <div className="text-muted flex items-center justify-between gap-3 text-xs font-semibold">
            <span>{formatSeconds(boundedPosition)}</span>
            <span>
              {hasDuration ? formatSeconds(durationSeconds) : '--:--.-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MusicConfig({
  musicFileInputRef,
  onMusicSourceChange,
  soundCheck,
}: SoundCheckProps & {
  musicFileInputRef: RefObject<HTMLInputElement | null>;
  onMusicSourceChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  const { durationSeconds, isPlaying, markSeconds, positionSeconds } =
    soundCheck.musicPlayback;
  const hasLoadedMusic = durationSeconds > 0;
  const needsFile =
    soundCheck.speakerTestSettings.musicSource === 'file' &&
    !soundCheck.speakerTestSettings.musicFile;
  const canUseTransport =
    soundCheck.speakerTestSettings.kind === 'music' &&
    !soundCheck.appPaused &&
    !soundCheck.outputMuted &&
    !needsFile;

  return (
    <div className="grid gap-4">
      <Field label="Music source">
        <div className="relative">
          <select
            id="speaker-music-source"
            name="speaker-music-source"
            value={soundCheck.speakerTestSettings.musicSource}
            onChange={onMusicSourceChange}
            className={joinClasses(
              controlClassName('output'),
              'appearance-none pr-9',
            )}
          >
            <option value="builtIn">Blinding Lights</option>
            <option value="file">Audio file</option>
          </select>
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2"
          />
        </div>
      </Field>

      {soundCheck.speakerTestSettings.musicSource === 'file' ? (
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

      <AudioPlaybackControls
        buttonLabel={isPlaying ? 'Pause music' : 'Play music'}
        canUseTransport={canUseTransport}
        durationSeconds={durationSeconds}
        isPlaying={isPlaying}
        onSeek={soundCheck.handleMusicSeek}
        onToggle={soundCheck.toggleMusicPlayback}
        positionSeconds={positionSeconds}
        seekLabel="Music playback position"
        seekName="music-playback-position"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outputSecondary"
          onClick={soundCheck.markMusicPosition}
          disabled={!hasLoadedMusic}
        >
          Mark part
        </Button>
        {markSeconds !== null ? (
          <Button
            variant="outputSecondary"
            onClick={soundCheck.playMusicFromMark}
            disabled={
              soundCheck.appPaused || soundCheck.outputMuted || !hasLoadedMusic
            }
          >
            Jump to {formatSeconds(markSeconds)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SettingsGroup({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  title?: string;
}) {
  return (
    <section className="border-line bg-panel-soft rounded-lg border p-4">
      {title || description ? (
        <div className="mb-4">
          {title ? (
            <h2 className="text-foreground text-sm font-semibold">{title}</h2>
          ) : null}
          {description ? (
            <p className="text-muted mt-1 text-xs leading-5">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function RefreshButton({
  accent,
  icon: Icon,
  label,
  onClick,
}: {
  accent: SectionAccent;
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
      className={joinClasses(
        'text-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg bg-transparent transition focus:outline-none active:translate-y-px active:scale-95',
        accent === 'input' && 'hover:bg-input/8',
        accent === 'output' && 'hover:bg-output/8',
      )}
    >
      <Icon
        aria-hidden="true"
        className={joinClasses('h-4 w-4', isSpinning && 'animate-spin')}
      />
    </button>
  );
}

function controlClassName(accent: SectionAccent) {
  return joinClasses(
    'border-line bg-panel text-foreground h-11 w-full rounded-lg border px-3 pr-10 text-sm transition outline-none focus:ring-4 appearance-none',
    accent === 'input' && 'focus:border-input focus:ring-input-soft',
    accent === 'output' && 'focus:border-output focus:ring-output-soft',
  );
}

function numberInputClassName(accent: SectionAccent) {
  return joinClasses(
    controlClassName(accent),
    'rounded-t-lg border-0 border-b-0 font-mono focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0',
  );
}

function rangeClassName(accent: SectionAccent) {
  return joinClasses(
    'h-11 w-full rounded-lg outline-none focus-visible:ring-4',
    accent === 'input' && 'accent-input focus-visible:ring-input-soft',
    accent === 'output' && 'accent-output focus-visible:ring-output-soft',
  );
}

function rangeBarClassName() {
  return joinClasses(
    'h-3 w-full cursor-ew-resize rounded-b-none rounded-t-none border-0 bg-line outline-none appearance-none',
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:m-0 [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-transparent',
    '[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:m-0 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent',
    '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-none',
    '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-none',
  );
}

function logScaleValue(
  value: number,
  min: number,
  max: number,
  scaleMin: number,
  scaleMax: number,
) {
  if (value <= min) {
    return scaleMin;
  }

  if (value >= max) {
    return scaleMax;
  }

  const clamped = clamp(value, min, max);
  const ratio =
    (Math.log10(clamped) - Math.log10(min)) /
    (Math.log10(max) - Math.log10(min));

  return scaleMin + Math.pow(ratio, LOG_SCALE_POWER) * (scaleMax - scaleMin);
}

function antiLogScaleValue(
  value: number,
  min: number,
  max: number,
  scaleMin: number,
  scaleMax: number,
  step: number,
) {
  const clamped = clamp(value, scaleMin, scaleMax);
  const ratio = (clamped - scaleMin) / (scaleMax - scaleMin);
  const adjustedRatio = Math.pow(ratio, 1 / LOG_SCALE_POWER);
  const raw = min * Math.pow(max / min, adjustedRatio);
  const quantized = Math.round(raw / step) * step;

  return clamp(quantized, min, max);
}

function RangeWithUnit({
  accent,
  ariaLabel,
  idBase,
  label,
  max,
  min,
  step,
  showLabel = true,
  scaleMode = 'linear',
  showValueInLabel = true,
  unit,
  value,
  onChange,
}: {
  accent: SectionAccent;
  ariaLabel: string;
  idBase: string;
  label: string;
  max: number;
  min: number;
  step: number;
  showLabel?: boolean;
  scaleMode?: 'linear' | 'log';
  showValueInLabel?: boolean;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const scaleMin = 0;
  const scaleMax = 1000;
  const isLogScale = scaleMode === 'log';
  const sliderMin = isLogScale ? scaleMin : min;
  const sliderMax = isLogScale ? scaleMax : max;
  const sliderStep = isLogScale ? 1 : step;
  const sliderValue = isLogScale
    ? logScaleValue(value, min, max, scaleMin, scaleMax)
    : value;
  const fillPercent = isLogScale
    ? clamp(((sliderValue - scaleMin) / (scaleMax - scaleMin)) * 100, 0, 100)
    : max === min
      ? 0
      : clamp(((value - min) / (max - min)) * 100, 0, 100);
  const fillColor = accent === 'input' ? '#2f8f4e' : '#2f70d0';
  const [isNumberEditing, setIsNumberEditing] = useState(false);

  return (
    <div className="grid gap-1">
      {showLabel ? (
        <Field label={showValueInLabel ? `${label}: ${value} ${unit}` : label}>
          <div
            className={joinClasses(
              'relative grid w-full overflow-hidden rounded-lg border transition-colors',
              isNumberEditing
                ? accent === 'input'
                  ? 'border-input'
                  : 'border-output'
                : 'border-line',
            )}
            style={{
              backgroundColor: 'var(--color-panel)',
            }}
          >
            <div className="relative">
              <input
                id={`${idBase}-number`}
                name={`${idBase}-number`}
                aria-label={ariaLabel}
                type="number"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                onFocus={() => setIsNumberEditing(true)}
                onBlur={() => setIsNumberEditing(false)}
                className={joinClasses(numberInputClassName(accent), 'pr-10')}
              />
              <span className="text-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
                {unit}
              </span>
            </div>
            <input
              id={idBase}
              name={idBase}
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={sliderValue}
              onChange={(event) => {
                const rawValue = Number(event.target.value);

                onChange(
                  isLogScale
                    ? antiLogScaleValue(
                        rawValue,
                        min,
                        max,
                        scaleMin,
                        scaleMax,
                        step,
                      )
                    : rawValue,
                );
              }}
              className={rangeBarClassName()}
              style={{
                background: `linear-gradient(to right, ${fillColor} ${fillPercent}%, var(--color-line) ${fillPercent}%)`,
              }}
            />
          </div>
        </Field>
      ) : (
        <div
          className={joinClasses(
            'relative grid w-full overflow-hidden rounded-lg border transition-colors',
            isNumberEditing
              ? accent === 'input'
                ? 'border-input'
                : 'border-output'
              : 'border-line',
          )}
          style={{
            backgroundColor: 'var(--color-panel)',
          }}
        >
          <div className="relative">
            <input
              id={`${idBase}-number`}
              name={`${idBase}-number`}
              aria-label={ariaLabel}
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(event) => onChange(Number(event.target.value))}
              onFocus={() => setIsNumberEditing(true)}
              onBlur={() => setIsNumberEditing(false)}
              className={joinClasses(numberInputClassName(accent), 'pr-10')}
            />
            <span className="text-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
              {unit}
            </span>
          </div>
          <input
            id={idBase}
            name={idBase}
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            value={sliderValue}
            onChange={(event) => {
              const rawValue = Number(event.target.value);

              onChange(
                isLogScale
                  ? antiLogScaleValue(
                      rawValue,
                      min,
                      max,
                      scaleMin,
                      scaleMax,
                      step,
                    )
                  : rawValue,
              );
            }}
            className={rangeBarClassName()}
            style={{
              background: `linear-gradient(to right, ${fillColor} ${fillPercent}%, var(--color-line) ${fillPercent}%)`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function checkboxClassName(accent: SectionAccent, className: string) {
  return joinClasses(
    className,
    accent === 'input' && 'accent-input',
    accent === 'output' && 'accent-output',
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
