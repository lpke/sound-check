import { MAX_MONITOR_DELAY_MS } from '@/utils/types';
import { formatSeconds } from '@/utils/utils';
import type { SoundCheckProps } from './componentTypes';
import { checkboxClassName } from './controlStyles';
import { HelpTip } from './HelpMode';
import { MicrophoneIcon } from './icons';
import { RangeWithUnit } from './RangeWithUnit';
import { SectionHeader, SectionShell, StickyIoChrome } from './sectionChrome';
import { SettingsGroup } from './settingsGroup';
import { Button, LevelMeter } from './ui';

export function InputSection({ soundCheck }: SoundCheckProps) {
  const isInputStopped = soundCheck.appPaused || soundCheck.inputMuted;

  return (
    <SectionShell muted={isInputStopped}>
      <StickyIoChrome>
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
          signalLevel={soundCheck.inputLevel}
          signalState={soundCheck.inputSignalState}
          toggleLabel={isInputStopped ? 'Unmute microphone' : 'Mute microphone'}
        />
        <LevelMeter
          accent="input"
          level={soundCheck.inputLevel}
          spectrum={soundCheck.inputSpectrum}
          spectrumPeaks={soundCheck.inputSpectrumPeaks}
        />
      </StickyIoChrome>

      <div className="grid gap-4 p-4 sm:p-5">
        <ProcessingBlock soundCheck={soundCheck} />
        <LiveMonitorBlock soundCheck={soundCheck} />
        <RecordingCapture soundCheck={soundCheck} />
      </div>
    </SectionShell>
  );
}

function ProcessingBlock({ soundCheck }: SoundCheckProps) {
  return (
    <SettingsGroup helpDescription="Adjust browser mic cleanup.">
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor="processing-enabled"
          className="text-foreground cursor-pointer text-sm font-semibold"
        >
          Enable capture processing
        </label>
        <HelpTip
          className="shrink-0"
          highlightClassName="rounded-sm"
          label="Toggle browser audio processing"
          lockedPlacement
          placement="bottom-end"
          showBubble={false}
        >
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
        </HelpTip>
      </div>

      <div className="border-line mt-3 grid gap-3 border-t pt-3 transition-[margin] duration-200 ease-out">
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
    <label className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        name={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className={checkboxClassName('input', 'mt-0.5 h-4 w-4 shrink-0')}
      />
      <span>
        <span className="text-foreground block text-sm font-semibold">
          {label}
        </span>
        <span className="text-muted mt-1 block text-xs leading-5">
          {description}
        </span>
      </span>
    </label>
  );
}

function LiveMonitorBlock({ soundCheck }: SoundCheckProps) {
  return (
    <SettingsGroup
      title="Live monitor"
      helpDescription="Hear the mic through speakers."
    >
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
  const latestRecordedClip = soundCheck.recordedClips.at(-1);

  return (
    <SettingsGroup helpDescription="Capture a mic test clip.">
      <div className="mb-4">
        <HelpTip
          className="inline-block"
          label="Record a clip"
          lockedPlacement
          placement="right"
        >
          <h2 className="text-foreground text-sm font-semibold">
            Record input
          </h2>
        </HelpTip>
      </div>
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
            : latestRecordedClip
              ? formatSeconds(latestRecordedClip.durationSeconds)
              : '00:00.0'}
        </p>
      </div>
    </SettingsGroup>
  );
}
