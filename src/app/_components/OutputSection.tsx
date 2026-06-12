import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react';
import {
  getSpeakerMusicQualityOptions,
  speakerMusicSources,
} from '@/utils/speakerMusic';
import type {
  SpeakerMusicQuality,
  SpeakerMusicSource,
  SpeakerTestKind,
} from '@/utils/types';
import {
  getDefaultDeviceCheckMessage,
  getDefaultDeviceUncertaintyMessage,
  hasSharedDeviceGroup,
} from '@/utils/deviceWarnings';
import { formatSeconds, joinClasses } from '@/utils/utils';
import type { SoundCheckProps } from './componentTypes';
import { controlClassName } from './controlStyles';
import { DeviceQualityNotice } from './DeviceWarning';
import { useHelpMode } from '@/hooks/useHelpMode';
import { HelpTarget, HelpTip } from './HelpMode';
import { BookmarkIcon, ChevronDownIcon, SpeakerIcon, XIcon } from './Icons';
import { AudioPlaybackControls, PlaybackIconButton } from './PlaybackControls';
import { RangeWithUnit } from './RangeWithUnit';
import { RecordingPlayback } from './RecordedPlaybackList';
import { SectionHeader, SectionShell, StickyIoChrome } from './SectionChrome';
import { SettingsGroup } from './SettingsGroup';
import { Button, Field, LevelMeter } from './UI';

const speakerTestOptions: { kind: SpeakerTestKind; label: string }[] = [
  { kind: 'tone', label: 'Steady tone' },
  { kind: 'modulatedTone', label: 'Modulating tone' },
  { kind: 'sweep', label: 'Frequency sweep' },
  { kind: 'dialUp', label: 'Dial-up' },
  { kind: 'music', label: 'Music' },
];
const HELP_DEMO_MUSIC_DURATION_SECONDS = 96;
const HELP_MUSIC_MARK_RATIOS = [0.4, 0.7] as const;

type HelpMusicMark = {
  id: string;
  seconds: number;
};

type VisibleMusicMark = HelpMusicMark & {
  kind: 'actual' | 'demo' | 'temporary';
};
type OutputQualityNoticeCard = 'recordedPlayback' | 'speakerTest';

function getHelpMusicMarks(durationSeconds: number, idPrefix: string) {
  return HELP_MUSIC_MARK_RATIOS.map((ratio, index) => ({
    id: `${idPrefix}-${index}`,
    seconds: Math.round(durationSeconds * ratio * 10) / 10,
  }));
}

function getDefaultHelpDemoMusicMarks() {
  return getHelpMusicMarks(
    HELP_DEMO_MUSIC_DURATION_SECONDS,
    'help-demo-music-mark',
  );
}

export function OutputSection({ soundCheck }: SoundCheckProps) {
  const [lastQualityNoticeCard, setLastQualityNoticeCard] =
    useState<OutputQualityNoticeCard | null>(null);
  const warningStorageKey = 'sound-check-audio-quality-warning-ignored';
  const musicFileInputRef = useRef<HTMLInputElement | null>(null);
  const isOutputStopped = soundCheck.appPaused || soundCheck.outputMuted;
  const testKind = soundCheck.speakerTestSettings.kind;
  const needsFrequency = usesToneFrequency(testKind);
  const isSpeakerTestActive = soundCheck.routedMode === 'speakerTest';
  const isToneTestPlaying = isSpeakerTestActive;
  const selectedInputDevice = soundCheck.inputDevices.find(
    (device) => device.deviceId === soundCheck.selectedInputId,
  );
  const selectedOutputDevice = soundCheck.outputDevices.find(
    (device) => device.deviceId === soundCheck.selectedOutputId,
  );
  const isInputOutputEnabled = !isOutputStopped && !soundCheck.inputMuted;
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
  const outputQualityWarning = shouldWarnSharedDevice ? (
    <>
      Mic and speaker are both on and using the same device.{' '}
      <strong>
        Some devices lower playback quality when input and output are active
        together.
      </strong>{' '}
      If quality sounds reduced, choose a different mic or speaker, or mute the
      mic.
    </>
  ) : isInputOutputEnabled && defaultDeviceUncertaintyMessage ? (
    <>
      Mic and speaker are both on. {defaultDeviceUncertaintyMessage}{' '}
      <strong>
        Some devices lower playback quality when input and output are active
        together.
      </strong>{' '}
      {defaultDeviceCheckMessage}
    </>
  ) : null;
  const outputQualityWarningTone = shouldWarnSharedDevice ? 'warning' : 'muted';
  const outputQualityNotice = outputQualityWarning ? (
    <DeviceQualityNotice
      accent="output"
      deviceKind="speaker"
      storageKey={warningStorageKey}
      tone={outputQualityWarningTone}
    />
  ) : null;
  const isSpeakerTestQualityNoticeActive =
    isSpeakerTestActive || soundCheck.musicPlayback.isLoading;
  const isRecordedPlaybackQualityNoticeActive =
    soundCheck.recordedPlayback.isPlaying;
  const hasActiveQualityNoticeCard =
    isSpeakerTestQualityNoticeActive || isRecordedPlaybackQualityNoticeActive;

  const showSpeakerTestQualityNotice =
    isSpeakerTestQualityNoticeActive ||
    (!hasActiveQualityNoticeCard && lastQualityNoticeCard === 'speakerTest');
  const showRecordedPlaybackQualityNotice =
    isRecordedPlaybackQualityNoticeActive ||
    (!hasActiveQualityNoticeCard &&
      lastQualityNoticeCard === 'recordedPlayback');

  function markSpeakerTestActive() {
    setLastQualityNoticeCard('speakerTest');
  }

  function markRecordedPlaybackActive() {
    setLastQualityNoticeCard('recordedPlayback');
  }

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

  function handleMusicQualityChange(event: ChangeEvent<HTMLSelectElement>) {
    soundCheck.handleSpeakerMusicQualityChange(
      event.target.value as SpeakerMusicQuality,
    );
  }

  return (
    <SectionShell muted={isOutputStopped}>
      <StickyIoChrome>
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
          signalLevel={soundCheck.outputLevel}
          signalState={soundCheck.outputSignalState}
          toggleLabel={isOutputStopped ? 'Unmute speaker' : 'Mute speaker'}
          warningMessage={outputQualityWarning}
          warningStorageKey={warningStorageKey}
          warningTone={outputQualityWarningTone}
        />
        <LevelMeter
          accent="output"
          level={soundCheck.outputLevel}
          spectrum={soundCheck.outputSpectrum}
          spectrumPeaks={soundCheck.outputSpectrumPeaks}
        />
      </StickyIoChrome>

      <div className="grid gap-4 p-4 sm:p-5">
        {soundCheck.canRequestOutput ? (
          <SettingsGroup
            title="Output access"
            description="Ask the browser for additional speaker choices when it supports explicit output selection."
            helpDescription="Find more speaker choices"
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
          animateDescription
          description={
            showSpeakerTestQualityNotice ? outputQualityNotice : null
          }
        >
          <div className="grid gap-4">
            <HelpTarget>
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
            </HelpTarget>

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
                onChange={soundCheck.handleSpeakerToneFrequencyChange}
              />
            ) : null}

            {testKind === 'music' ? (
              <>
                <input
                  ref={musicFileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) =>
                    soundCheck.handleSpeakerMusicFileChange(
                      event.target.files?.[0] ?? null,
                    )
                  }
                />
                <MusicConfig
                  musicFileInputRef={musicFileInputRef}
                  onMusicQualityChange={handleMusicQualityChange}
                  onMusicSourceChange={handleMusicSourceChange}
                  onPlaybackActivate={markSpeakerTestActive}
                  soundCheck={soundCheck}
                />
              </>
            ) : testKind === 'dialUp' ? (
              <DialUpConfig
                onPlaybackActivate={markSpeakerTestActive}
                soundCheck={soundCheck}
              />
            ) : (
              <div>
                <Button
                  variant={isToneTestPlaying ? 'danger' : 'outputPrimary'}
                  className="w-40"
                  onClick={() => {
                    if (isToneTestPlaying) {
                      soundCheck.stopPlaybackOutput();
                      return;
                    }

                    markSpeakerTestActive();
                    soundCheck.startSpeakerTest();
                  }}
                  disabled={soundCheck.appPaused || soundCheck.outputMuted}
                >
                  {isToneTestPlaying ? 'Stop test sound' : 'Play test sound'}
                </Button>
              </div>
            )}
          </div>
        </SettingsGroup>

        <RecordingPlayback
          onPlaybackActivate={markRecordedPlaybackActive}
          qualityNotice={
            showRecordedPlaybackQualityNotice ? outputQualityNotice : null
          }
          soundCheck={soundCheck}
        />
      </div>
    </SectionShell>
  );
}

function DialUpConfig({
  onPlaybackActivate,
  soundCheck,
}: SoundCheckProps & { onPlaybackActivate: () => void }) {
  const { durationSeconds, isLoading, isPlaying, positionSeconds } =
    soundCheck.musicPlayback;
  const canUseTransport =
    soundCheck.speakerTestSettings.kind === 'dialUp' &&
    !soundCheck.appPaused &&
    !soundCheck.outputMuted;

  return (
    <AudioPlaybackControls
      buttonLabel={
        isLoading
          ? 'Loading dial-up tones'
          : isPlaying
            ? 'Pause dial-up tones'
            : 'Play dial-up tones'
      }
      canUseTransport={canUseTransport}
      durationSeconds={durationSeconds}
      isLoading={isLoading}
      isPlaying={isPlaying}
      onSeek={soundCheck.handleMusicSeek}
      onToggle={() => {
        onPlaybackActivate();
        soundCheck.toggleMusicPlayback();
      }}
      positionSeconds={positionSeconds}
      seekLabel="Dial-up playback position"
      seekName="dial-up-playback-position"
    />
  );
}

function MusicConfig({
  musicFileInputRef,
  onMusicQualityChange,
  onMusicSourceChange,
  onPlaybackActivate,
  soundCheck,
}: SoundCheckProps & {
  musicFileInputRef: RefObject<HTMLInputElement | null>;
  onMusicQualityChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onMusicSourceChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onPlaybackActivate: () => void;
}) {
  const { isHelpModeActive, isHelpModeExiting } = useHelpMode();
  const {
    durationSeconds,
    isLoading,
    isPlaying,
    loadingPhase,
    loadingProgressPercent,
    marks,
    positionSeconds,
  } = soundCheck.musicPlayback;
  const [demoMusicMarks, setDemoMusicMarks] = useState<HelpMusicMark[]>(
    getDefaultHelpDemoMusicMarks,
  );
  const [temporaryMusicMarks, setTemporaryMusicMarks] = useState<
    HelpMusicMark[]
  >([]);
  const [demoMusicPositionSeconds, setDemoMusicPositionSeconds] = useState(32);
  const hasLoadedMusic = durationSeconds > 0;
  const shouldUseDemoMusic =
    isHelpModeActive && !hasLoadedMusic && !isLoading && marks.length === 0;
  const effectiveDurationSeconds = shouldUseDemoMusic
    ? HELP_DEMO_MUSIC_DURATION_SECONDS
    : durationSeconds;
  const effectivePositionSeconds = shouldUseDemoMusic
    ? demoMusicPositionSeconds
    : positionSeconds;
  const visibleMarks: VisibleMusicMark[] =
    marks.length > 0
      ? marks.map((mark) => ({ ...mark, kind: 'actual' }))
      : isHelpModeActive && hasLoadedMusic
        ? temporaryMusicMarks.map((mark) => ({ ...mark, kind: 'temporary' }))
        : shouldUseDemoMusic
          ? demoMusicMarks.map((mark) => ({ ...mark, kind: 'demo' }))
          : [];
  const needsFile =
    soundCheck.speakerTestSettings.musicSource === 'file' &&
    !soundCheck.speakerTestSettings.musicFile;
  const canUseTransport =
    soundCheck.speakerTestSettings.kind === 'music' &&
    !soundCheck.appPaused &&
    !soundCheck.outputMuted &&
    !needsFile;
  const isHelpModeOpen = isHelpModeActive && !isHelpModeExiting;
  const musicQualityOptions = getSpeakerMusicQualityOptions(
    soundCheck.speakerTestSettings.musicSource,
  );
  const selectedMusicQuality =
    musicQualityOptions.find(
      (qualityOption) =>
        qualityOption.format === soundCheck.speakerTestSettings.musicQuality,
    ) ??
    musicQualityOptions[0] ??
    null;
  const loadingButtonLabel =
    loadingPhase === 'downloading'
      ? 'Downloading'
      : loadingPhase === 'decoding'
        ? 'Decoding'
        : 'Loading music';

  useEffect(() => {
    const updateTimer = window.setTimeout(() => {
      if (!isHelpModeActive) {
        setDemoMusicMarks(getDefaultHelpDemoMusicMarks());
        setTemporaryMusicMarks([]);
        setDemoMusicPositionSeconds(32);
        return;
      }

      if (!hasLoadedMusic || isLoading || marks.length > 0) {
        setTemporaryMusicMarks([]);
        return;
      }

      setTemporaryMusicMarks(
        getHelpMusicMarks(
          durationSeconds,
          `help-temporary-music-mark-${Math.round(durationSeconds * 10)}`,
        ),
      );
    }, 0);

    return () => window.clearTimeout(updateTimer);
  }, [
    durationSeconds,
    hasLoadedMusic,
    isHelpModeActive,
    isLoading,
    marks.length,
  ]);

  return (
    <div className="grid gap-4">
      <HelpTarget>
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
              {speakerMusicSources.map((option) => (
                <option key={option.source} value={option.source}>
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
      </HelpTarget>

      {musicQualityOptions.length > 0 ? (
        <HelpTarget>
          <Field label="Music quality">
            <div className="relative">
              <select
                id="speaker-music-quality"
                name="speaker-music-quality"
                value={selectedMusicQuality?.format ?? ''}
                onChange={onMusicQualityChange}
                disabled={musicQualityOptions.length <= 1}
                className={joinClasses(
                  controlClassName('output'),
                  'appearance-none pr-9 disabled:cursor-not-allowed',
                )}
              >
                {musicQualityOptions.map((option) => (
                  <option key={option.format} value={option.format}>
                    {option.displayLabel}
                  </option>
                ))}
              </select>
              <ChevronDownIcon
                aria-hidden="true"
                className="text-muted pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2"
              />
            </div>
          </Field>
        </HelpTarget>
      ) : null}

      {soundCheck.speakerTestSettings.musicSource === 'file' ? (
        <HelpTarget>
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
        </HelpTarget>
      ) : null}

      <HelpTarget
        activeClassName="z-50"
        className={joinClasses(
          'relative rounded-lg transition-[margin] [transition-duration:var(--help-motion-duration)]',
          isHelpModeExiting
            ? '[transition-timing-function:var(--help-motion-exit-ease)]'
            : '[transition-timing-function:var(--help-motion-enter-ease)]',
          isHelpModeOpen && visibleMarks.length > 0 && 'mb-10',
        )}
      >
        <AudioPlaybackControls
          buttonLabel={
            isLoading
              ? loadingButtonLabel
              : isPlaying
                ? 'Pause music'
                : 'Play music'
          }
          canUseTransport={canUseTransport}
          centerControls={
            <HelpTip
              activeClassName="z-[75]"
              className="mr-1 -ml-3 inline-flex"
              bubbleClassName="-ml-6 -mt-1 whitespace-nowrap"
              label="Add mark"
              layout="overlay"
              placement="bottom"
              tipClassName="[--help-tip-gap:0.25rem]"
            >
              <PlaybackIconButton
                disabled={isLoading || (!hasLoadedMusic && !shouldUseDemoMusic)}
                label="Mark current position"
                onClick={() => {
                  if (hasLoadedMusic) {
                    soundCheck.markMusicPosition();
                    return;
                  }

                  const nextMarkSeconds = Math.min(
                    HELP_DEMO_MUSIC_DURATION_SECONDS,
                    demoMusicPositionSeconds,
                  );

                  setDemoMusicMarks((currentMarks) => [
                    ...currentMarks,
                    {
                      id: `help-demo-music-mark-${Date.now()}`,
                      seconds: nextMarkSeconds,
                    },
                  ]);
                }}
                className="!h-8 !w-8 hover:scale-95"
                tone="output"
              >
                <BookmarkIcon aria-hidden="true" className="h-5 w-5" />
              </PlaybackIconButton>
            </HelpTip>
          }
          durationSeconds={effectiveDurationSeconds}
          isLoading={isLoading}
          isPlaying={isPlaying}
          loadingProgressPercent={
            loadingPhase === 'downloading' ? loadingProgressPercent : null
          }
          markers={visibleMarks.map((mark) => ({
            id: mark.id,
            label: `Mark at ${formatSeconds(mark.seconds)}`,
            seconds: mark.seconds,
          }))}
          onSeek={(nextPosition) => {
            if (shouldUseDemoMusic) {
              setDemoMusicPositionSeconds(nextPosition);
              return;
            }

            soundCheck.handleMusicSeek(nextPosition);
          }}
          onToggle={() => {
            onPlaybackActivate();
            soundCheck.toggleMusicPlayback();
          }}
          positionSeconds={effectivePositionSeconds}
          seekLabel="Music playback position"
          seekName="music-playback-position"
        />
      </HelpTarget>

      {visibleMarks.length > 0 ? (
        <HelpTip
          className="block"
          label="Jump to mark"
          placement="bottom-start"
          tipClassName="[--help-tip-gap:0.375rem]"
          bubbleClassName="mt-1"
        >
          <div className="flex flex-wrap gap-2">
            {visibleMarks.map((mark) => (
              <span
                key={mark.id}
                className="border-output/25 bg-output-soft text-output inline-flex h-9 overflow-hidden rounded-lg border text-xs font-semibold"
              >
                <button
                  type="button"
                  className="hover:bg-output-soft/70 flex h-full items-center px-3 font-mono transition focus:outline-none active:translate-y-px active:scale-[0.985] disabled:opacity-50 disabled:active:translate-y-0 disabled:active:scale-100"
                  title={`Play from ${formatSeconds(mark.seconds)}`}
                  onClick={() => {
                    if (mark.kind === 'demo') {
                      setDemoMusicPositionSeconds(mark.seconds);
                      return;
                    }

                    onPlaybackActivate();
                    soundCheck.playMusicFromMark(mark.seconds);
                  }}
                  disabled={
                    mark.kind !== 'demo' &&
                    (soundCheck.appPaused ||
                      isLoading ||
                      soundCheck.outputMuted ||
                      !hasLoadedMusic)
                  }
                >
                  {formatSeconds(mark.seconds)}
                </button>
                <button
                  type="button"
                  aria-label={`Delete mark at ${formatSeconds(mark.seconds)}`}
                  title={`Delete mark at ${formatSeconds(mark.seconds)}`}
                  className="border-output/20 hover:bg-output/8 text-output/60 hover:text-output flex h-full w-8 items-center justify-center border-l transition focus:outline-none active:translate-y-px active:scale-[0.95]"
                  onClick={() => {
                    if (mark.kind === 'demo') {
                      setDemoMusicMarks((currentMarks) =>
                        currentMarks.filter(
                          (currentMark) => currentMark.id !== mark.id,
                        ),
                      );
                      return;
                    }

                    if (mark.kind === 'temporary') {
                      setTemporaryMusicMarks((currentMarks) =>
                        currentMarks.filter(
                          (currentMark) => currentMark.id !== mark.id,
                        ),
                      );
                      return;
                    }

                    soundCheck.deleteMusicMark(mark.id);
                  }}
                >
                  <XIcon aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </HelpTip>
      ) : null}
    </div>
  );
}

function usesToneFrequency(kind: SpeakerTestKind) {
  return kind === 'tone' || kind === 'modulatedTone' || kind === 'sweep';
}
