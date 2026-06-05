import type { SoundCheckController } from '@/utils/useSoundCheck';
import { getDeviceLabel } from '@/utils/devices';
import { MAX_MONITOR_DELAY_MS } from '@/utils/types';
import { formatSeconds, joinClasses } from '@/utils/utils';
import {
  Button,
  DeviceSummary,
  Field,
  LevelMeter,
  OutputReadout,
  Panel,
  StatusPill,
  Toggle,
} from './ui';

type SoundCheckProps = {
  soundCheck: SoundCheckController;
};

export function AppHeader({ soundCheck }: SoundCheckProps) {
  return (
    <header className="border-line flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <p className="text-control text-sm font-semibold">Sound Check</p>
        <h1 className="font-headline text-foreground mt-1 text-3xl font-semibold sm:text-4xl">
          Audio device test bench
        </h1>
        <p className="text-muted mt-2 text-sm leading-6">
          Choose each side of the audio path, test raw microphone capture, route
          playback to the selected speaker, and stop everything instantly when
          needed.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={soundCheck.appPaused ? 'warn' : 'good'}>
          {soundCheck.appPaused ? 'Paused' : 'Active'}
        </StatusPill>
        <StatusPill
          tone={
            soundCheck.permissionState === 'granted' && !soundCheck.appPaused
              ? 'good'
              : 'idle'
          }
        >
          {soundCheck.appPaused
            ? 'Input stopped'
            : soundCheck.permissionState === 'granted'
              ? 'Mic enabled'
              : 'Mic locked'}
        </StatusPill>
        <StatusPill tone={soundCheck.canRouteOutput ? 'good' : 'warn'}>
          {soundCheck.canRouteOutput
            ? 'Output routing ready'
            : 'Default output only'}
        </StatusPill>
        <Button
          variant={soundCheck.appPaused ? 'primary' : 'secondary'}
          onClick={
            soundCheck.appPaused ? soundCheck.resumeApp : soundCheck.pauseApp
          }
        >
          {soundCheck.appPaused ? 'Resume app' : 'Pause app'}
        </Button>
      </div>
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

export function InputLane({ soundCheck }: SoundCheckProps) {
  return (
    <section className="border-line bg-panel overflow-hidden rounded-lg border shadow-sm">
      <LaneHeader
        accent="input"
        label="Input"
        title="Microphone"
        statusLabel={soundCheck.inputStatus.shortLabel}
      />

      <div className="grid gap-5 p-4 sm:p-5">
        <section className="grid gap-4">
          <Field label="Source">
            <select
              id="input-device"
              name="input-device"
              value={soundCheck.selectedInputId}
              onChange={soundCheck.handleInputChange}
              className="border-line bg-panel text-foreground focus:border-control focus:ring-control-soft h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-4"
            >
              {soundCheck.inputDevices.length === 0 ? (
                <option value="">No microphone detected</option>
              ) : (
                soundCheck.inputDevices.map((device, index) => (
                  <option
                    key={`${device.deviceId}-${index}`}
                    value={device.deviceId}
                  >
                    {getDeviceLabel(
                      device,
                      soundCheck.inputDevices,
                      'audioinput',
                    )}
                  </option>
                ))
              )}
            </select>
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={soundCheck.appPaused}
              onClick={soundCheck.requestMicrophoneAccess}
            >
              Enable microphone
            </Button>
            <Button variant="secondary" onClick={soundCheck.refreshDevices}>
              Refresh devices
            </Button>
          </div>

          <DeviceSummary
            label="Selected input"
            value={soundCheck.selectedInputName}
          />
        </section>

        <SignalMeter
          label="Input level"
          level={soundCheck.inputLevel}
          statusText={soundCheck.inputStatus.label}
          statusTone={soundCheck.inputStatus.tone}
        />

        <ProcessingBlock soundCheck={soundCheck} />

        <section className="grid gap-4">
          <h2 className="text-foreground text-sm font-semibold">
            Live monitor
          </h2>
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
            <span className="border-line bg-panel-soft text-muted flex h-11 items-center rounded-lg border px-3 text-sm">
              ms
            </span>
          </div>
          {soundCheck.monitorEnabled ? (
            <Button variant="secondary" onClick={soundCheck.stopMonitor}>
              Stop monitor
            </Button>
          ) : (
            <Button
              disabled={soundCheck.appPaused}
              onClick={soundCheck.startMonitor}
            >
              Start monitor
            </Button>
          )}
        </section>

        <RecordingCapture soundCheck={soundCheck} />
      </div>
    </section>
  );
}

export function OutputLane({ soundCheck }: SoundCheckProps) {
  return (
    <section className="border-line bg-panel overflow-hidden rounded-lg border shadow-sm">
      <LaneHeader
        accent="output"
        label="Output"
        title="Speaker"
        statusLabel={soundCheck.outputStatus.shortLabel}
      />

      <div className="grid gap-5 p-4 sm:p-5">
        <section className="grid gap-4">
          <Field label="Destination">
            <select
              id="output-device"
              name="output-device"
              value={soundCheck.selectedOutputId}
              onChange={soundCheck.handleOutputChange}
              disabled={!soundCheck.canRouteOutput}
              className="border-line bg-panel text-foreground focus:border-control focus:ring-control-soft disabled:bg-panel-soft disabled:text-muted h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-4"
            >
              {soundCheck.outputDevices.map((device, index) => (
                <option
                  key={`${device.deviceId}-${index}`}
                  value={device.deviceId}
                >
                  {getDeviceLabel(
                    device,
                    soundCheck.outputDevices,
                    'audiooutput',
                  )}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-wrap gap-2">
            {soundCheck.canRequestOutput ? (
              <Button
                variant="secondary"
                onClick={soundCheck.requestOutputAccess}
              >
                Choose speaker
              </Button>
            ) : null}
            <Button variant="secondary" onClick={soundCheck.refreshDevices}>
              Refresh devices
            </Button>
          </div>

          <DeviceSummary
            label="Selected output"
            value={soundCheck.selectedOutputName}
          />
        </section>

        <OutputReadout
          outputStatus={soundCheck.outputStatus}
          level={soundCheck.outputLevel}
        />

        <section className="grid gap-4">
          <div>
            <h2 className="text-foreground text-sm font-semibold">
              Speaker test
            </h2>
            <p className="text-muted mt-1 text-xs leading-5">
              Plays a fixed 440 Hz tone through the selected output.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={soundCheck.startToneTest}
              disabled={
                soundCheck.appPaused ||
                (soundCheck.routedMode !== 'idle' &&
                  soundCheck.routedMode !== 'tone')
              }
            >
              Play test sound
            </Button>
            {soundCheck.routedMode === 'tone' && !soundCheck.appPaused ? (
              <Button variant="secondary" onClick={soundCheck.stopOutputGraph}>
                Stop
              </Button>
            ) : null}
          </div>
        </section>

        <RecordingPlayback soundCheck={soundCheck} />
      </div>
    </section>
  );
}

export function SessionStatusPanel({ soundCheck }: SoundCheckProps) {
  return (
    <section className="border-line bg-panel rounded-lg border px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-foreground text-sm font-semibold">
            Session status
          </p>
          <p className="text-muted mt-1 text-sm">{soundCheck.statusMessage}</p>
        </div>
        <StatusPill tone={soundCheck.errorMessage ? 'danger' : 'good'}>
          {soundCheck.errorMessage ? 'Needs attention' : 'Ready'}
        </StatusPill>
      </div>
      {soundCheck.errorMessage ? (
        <p className="border-danger/30 bg-danger-soft text-danger mt-3 rounded-lg border px-3 py-2 text-sm">
          {soundCheck.errorMessage}
        </p>
      ) : null}
    </section>
  );
}

function LaneHeader({
  accent,
  label,
  statusLabel,
  title,
}: {
  accent: 'input' | 'output';
  label: string;
  statusLabel: string;
  title: string;
}) {
  return (
    <div
      className={joinClasses(
        'border-line flex items-center justify-between gap-4 border-b px-4 py-4 sm:px-5',
        accent === 'input' && 'bg-input-soft',
        accent === 'output' && 'bg-output-soft',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={joinClasses(
            'flex h-11 w-11 items-center justify-center rounded-full font-mono text-sm font-semibold text-white',
            accent === 'input' && 'bg-input',
            accent === 'output' && 'bg-output',
          )}
        >
          {accent === 'input' ? 'IN' : 'OUT'}
        </span>
        <div>
          <p
            className={joinClasses(
              'text-xs font-semibold uppercase',
              accent === 'input' && 'text-input',
              accent === 'output' && 'text-output',
            )}
          >
            {label}
          </p>
          <h2 className="font-headline text-foreground text-xl font-semibold">
            {title}
          </h2>
        </div>
      </div>
      <span className="border-line bg-panel/80 text-muted rounded-full border px-3 py-1 text-xs font-semibold">
        {statusLabel}
      </span>
    </div>
  );
}

function SignalMeter({
  label,
  level,
  statusText,
  statusTone,
}: {
  label: string;
  level: number;
  statusText: string;
  statusTone: SoundCheckController['inputStatus']['tone'];
}) {
  return (
    <section className="border-line bg-panel-soft rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground text-sm font-semibold">{label}</h2>
          <p className="text-muted mt-1 text-xs">{statusText}</p>
        </div>
        <StatusPill tone={statusTone}>
          {level > 0 ? `${Math.round(level * 100)}%` : 'Idle'}
        </StatusPill>
      </div>
      <LevelMeter className="mt-4" level={level} />
    </section>
  );
}

function ProcessingBlock({ soundCheck }: SoundCheckProps) {
  return (
    <section className="grid gap-3">
      <Toggle
        checked={soundCheck.processingEnabled}
        description="Browser capture processing. Off gives the raw microphone stream for monitoring and recording."
        id="processing-enabled"
        label="Enable processing"
        onChange={soundCheck.handleProcessingEnabledChange}
      />

      <div className="grid gap-2">
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
    </section>
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
    <label className="border-line bg-panel-soft flex items-start gap-3 rounded-lg border px-3 py-2">
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

function RecordingCapture({ soundCheck }: SoundCheckProps) {
  return (
    <section className="border-line bg-panel-soft rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground text-sm font-semibold">
            Record input
          </h2>
          <p className="text-muted mt-1 font-mono text-xs">
            {soundCheck.isRecording
              ? formatSeconds(soundCheck.recordingSeconds)
              : soundCheck.recordedClip
                ? formatSeconds(soundCheck.recordedClip.durationSeconds)
                : '00:00.0'}
          </p>
        </div>
        <StatusPill tone={soundCheck.isRecording ? 'danger' : 'idle'}>
          {soundCheck.isRecording ? 'Recording' : 'Ready'}
        </StatusPill>
      </div>

      <div className="mt-4">
        {soundCheck.isRecording ? (
          <Button variant="danger" onClick={soundCheck.stopRecording}>
            Stop recording
          </Button>
        ) : (
          <Button
            disabled={soundCheck.appPaused}
            onClick={soundCheck.startRecording}
          >
            Record input
          </Button>
        )}
      </div>
    </section>
  );
}

function RecordingPlayback({ soundCheck }: SoundCheckProps) {
  return (
    <section className="border-line bg-panel-soft rounded-lg border p-4">
      <div>
        <h2 className="text-foreground text-sm font-semibold">
          Recorded playback
        </h2>
        <p className="text-muted mt-1 text-xs leading-5">
          {soundCheck.recordedClip
            ? `${soundCheck.recordedClip.mimeType || 'audio'} clip ready.`
            : 'No clip recorded.'}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={soundCheck.playRecordedClip}
          disabled={
            soundCheck.appPaused ||
            !soundCheck.recordedClip ||
            soundCheck.routedMode === 'clip'
          }
        >
          Play recording
        </Button>
        {soundCheck.routedMode === 'clip' ? (
          <Button variant="secondary" onClick={soundCheck.stopOutputGraph}>
            Stop
          </Button>
        ) : null}
      </div>
    </section>
  );
}
