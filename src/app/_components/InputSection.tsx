import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  getDefaultDeviceCheckMessage,
  getDefaultDeviceUncertaintyMessage,
  hasSharedDeviceGroup,
} from '@/utils/deviceWarnings';
import { MAX_MONITOR_DELAY_MS } from '@/utils/types';
import { clamp, formatSeconds, joinClasses } from '@/utils/utils';
import type { SoundCheckProps } from './componentTypes';
import { checkboxClassName } from './controlStyles';
import { DeviceQualityNotice } from './DeviceWarning';
import { useHelpMode } from '@/hooks/useHelpMode';
import { HelpTarget, HelpTip } from './HelpMode';
import { MicrophoneIcon } from './Icons';
import { RangeWithUnit } from './RangeWithUnit';
import { SectionHeader, SectionShell, StickyIoChrome } from './SectionChrome';
import { SettingsGroup } from './SettingsGroup';
import { Button, LevelMeter } from './UI';

type InputQualityNoticeCard = 'monitor' | 'recording';

export function InputSection({ soundCheck }: SoundCheckProps) {
  const [lastQualityNoticeCard, setLastQualityNoticeCard] =
    useState<InputQualityNoticeCard | null>(null);
  const warningStorageKey = 'sound-check-audio-quality-warning-ignored';
  const isInputStopped = soundCheck.appPaused || soundCheck.inputMuted;
  const selectedInputDevice = soundCheck.inputDevices.find(
    (device) => device.deviceId === soundCheck.selectedInputId,
  );
  const selectedOutputDevice = soundCheck.outputDevices.find(
    (device) => device.deviceId === soundCheck.selectedOutputId,
  );
  const isInputOutputEnabled = !isInputStopped && !soundCheck.outputMuted;
  const defaultDeviceUncertaintyMessage = getDefaultDeviceUncertaintyMessage(
    soundCheck.selectedInputId,
    soundCheck.selectedOutputId,
  );
  const defaultDeviceCheckMessage = getDefaultDeviceCheckMessage(
    soundCheck.selectedInputId,
    soundCheck.selectedOutputId,
  );
  const shouldWarnSharedDevice =
    isInputOutputEnabled &&
    hasSharedDeviceGroup(selectedInputDevice, selectedOutputDevice);
  const inputQualityWarning = shouldWarnSharedDevice ? (
    <>
      Mic and speaker are both on and using the same device.{' '}
      <strong>
        Some devices lower mic quality when input and output are active
        together.
      </strong>{' '}
      If quality sounds reduced, choose a different mic or speaker, or mute the
      speaker.
    </>
  ) : isInputOutputEnabled && defaultDeviceUncertaintyMessage ? (
    <>
      Mic and speaker are both on. {defaultDeviceUncertaintyMessage}{' '}
      <strong>
        Some devices lower mic quality when input and output are active
        together.
      </strong>{' '}
      {defaultDeviceCheckMessage}
    </>
  ) : null;
  const inputQualityWarningTone = shouldWarnSharedDevice ? 'warning' : 'muted';
  const inputQualityNotice = inputQualityWarning ? (
    <DeviceQualityNotice
      accent="input"
      deviceKind="mic"
      storageKey={warningStorageKey}
      tone={inputQualityWarningTone}
    />
  ) : null;
  const hasActiveQualityNoticeCard =
    soundCheck.monitorEnabled || soundCheck.isRecording;

  const showMonitorQualityNotice =
    soundCheck.monitorEnabled ||
    (!hasActiveQualityNoticeCard && lastQualityNoticeCard === 'monitor');
  const showRecordingQualityNotice =
    soundCheck.isRecording ||
    (!hasActiveQualityNoticeCard && lastQualityNoticeCard === 'recording');

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
          isRecording={soundCheck.isRecording}
          signalLevel={soundCheck.inputLevel}
          signalState={soundCheck.inputSignalState}
          toggleLabel={isInputStopped ? 'Unmute microphone' : 'Mute microphone'}
          warningMessage={inputQualityWarning}
          warningStorageKey={warningStorageKey}
          warningTone={inputQualityWarningTone}
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
        <LiveMonitorBlock
          onActivate={() => setLastQualityNoticeCard('monitor')}
          qualityNotice={showMonitorQualityNotice ? inputQualityNotice : null}
          soundCheck={soundCheck}
        />
        <RecordingCapture
          onActivate={() => setLastQualityNoticeCard('recording')}
          qualityNotice={showRecordingQualityNotice ? inputQualityNotice : null}
          soundCheck={soundCheck}
        />
      </div>
    </SectionShell>
  );
}

function ProcessingBlock({ soundCheck }: SoundCheckProps) {
  return (
    <SettingsGroup>
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor="processing-enabled"
          className="text-foreground cursor-pointer text-sm font-semibold"
        >
          Enable capture processing
        </label>
        <HelpTarget className="shrink-0" highlightClassName="rounded-sm">
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
        </HelpTarget>
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

function LiveMonitorBlock({
  onActivate,
  qualityNotice,
  soundCheck,
}: SoundCheckProps & { onActivate: () => void; qualityNotice: ReactNode }) {
  return (
    <SettingsGroup title="Live monitor" description={qualityNotice}>
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
            onClick={() => {
              onActivate();
              soundCheck.startMonitor();
            }}
          >
            Start monitor
          </Button>
        )}
      </div>
    </SettingsGroup>
  );
}

function RecordingCapture({
  onActivate,
  qualityNotice,
  soundCheck,
}: SoundCheckProps & { onActivate: () => void; qualityNotice: ReactNode }) {
  const { isHelpModeActive, isHelpModeExiting } = useHelpMode();
  const latestRecordedClip = soundCheck.recordedClips.at(-1);
  const recordingInputLevel = clamp(soundCheck.inputLevel, 0, 1);
  const recordingHaloLevel = Math.sqrt(recordingInputLevel);
  const isHelpModeOpen = isHelpModeActive && !isHelpModeExiting;

  return (
    <SettingsGroup
      className={
        soundCheck.isRecording ? 'recording-capture-card-active' : undefined
      }
      style={
        soundCheck.isRecording
          ? ({
              '--recording-border-alpha': 0.42 + recordingHaloLevel * 0.38,
              '--recording-halo-alpha': 0.08 + recordingHaloLevel * 0.12,
              '--recording-halo-blur': `${0.28 + recordingHaloLevel * 0.62}rem`,
              '--recording-halo-size': `${0.1 + recordingHaloLevel * 0.32}rem`,
              '--recording-inner-alpha': 0.12 + recordingHaloLevel * 0.16,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="mb-4">
        <h2 className="text-foreground text-sm font-semibold">Record input</h2>
        {qualityNotice ? (
          <p className="text-muted mt-1 text-xs leading-5">{qualityNotice}</p>
        ) : null}
      </div>
      <div
        className={joinClasses(
          'grid transition-[grid-template-rows] [transition-duration:var(--help-motion-duration)]',
          isHelpModeExiting
            ? '[transition-timing-function:var(--help-motion-exit-ease)]'
            : '[transition-timing-function:var(--help-motion-enter-ease)]',
          isHelpModeOpen ? 'grid-rows-[2.5rem_auto]' : 'grid-rows-[0rem_auto]',
        )}
      >
        <div aria-hidden="true" className="overflow-hidden" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <HelpTip
            label="Can record multiple clips"
            layout="overlay"
            placement="top"
            className="w-40"
          >
            {soundCheck.isRecording ? (
              <Button
                variant="danger"
                onClick={soundCheck.stopRecording}
                className="w-full"
              >
                Stop recording
              </Button>
            ) : (
              <Button
                disabled={soundCheck.appPaused || soundCheck.inputMuted}
                onClick={() => {
                  onActivate();
                  soundCheck.startRecording();
                }}
                className="w-full"
              >
                Record input
              </Button>
            )}
          </HelpTip>

          <p className="text-muted font-mono text-xl leading-none font-semibold tabular-nums">
            {soundCheck.isRecording
              ? formatSeconds(soundCheck.recordingSeconds)
              : latestRecordedClip
                ? formatSeconds(latestRecordedClip.durationSeconds)
                : '00:00.0'}
          </p>
        </div>
      </div>
    </SettingsGroup>
  );
}
