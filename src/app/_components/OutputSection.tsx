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
import { getDefaultDeviceUncertaintyMessage } from '@/utils/deviceWarnings';
import { formatSeconds, joinClasses } from '@/utils/utils';
import type { SoundCheckProps } from './componentTypes';
import { controlClassName } from './controlStyles';
import { useHelpMode } from '@/hooks/useHelpMode';
import { HelpTarget, HelpTip } from './HelpMode';
import {
  BookmarkIcon,
  ChevronDownIcon,
  SpeakerIcon,
  TrashIcon,
  XIcon,
} from './Icons';
import { AudioPlaybackControls, PlaybackIconButton } from './PlaybackControls';
import { RangeWithUnit } from './RangeWithUnit';
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
const HELP_DEMO_RECORDING_DURATION_SECONDS = 5;
const HELP_DEMO_MUSIC_DURATION_SECONDS = 96;
const HELP_MUSIC_MARK_RATIOS = [0.4, 0.7] as const;

type HelpMusicMark = {
  id: string;
  seconds: number;
};

type VisibleMusicMark = HelpMusicMark & {
  kind: 'actual' | 'demo' | 'temporary';
};

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
  const shouldWarnSharedDevice =
    isInputOutputEnabled &&
    Boolean(selectedInputDevice?.groupId) &&
    selectedInputDevice?.groupId === selectedOutputDevice?.groupId;
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
      Select a specific mic or speaker to check.
    </>
  ) : null;
  const outputQualityWarningTone = shouldWarnSharedDevice ? 'warning' : 'muted';

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
          warningStorageKey="sound-check-audio-quality-warning-ignored"
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

        <SettingsGroup title="Speaker test">
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
                  soundCheck={soundCheck}
                />
              </>
            ) : testKind === 'dialUp' ? (
              <DialUpConfig soundCheck={soundCheck} />
            ) : (
              <div>
                <Button
                  variant={isToneTestPlaying ? 'danger' : 'outputPrimary'}
                  className="w-40"
                  onClick={
                    isToneTestPlaying
                      ? soundCheck.stopPlaybackOutput
                      : soundCheck.startSpeakerTest
                  }
                  disabled={soundCheck.appPaused || soundCheck.outputMuted}
                >
                  {isToneTestPlaying ? 'Stop test sound' : 'Play test sound'}
                </Button>
              </div>
            )}
          </div>
        </SettingsGroup>

        <RecordingPlayback soundCheck={soundCheck} />
      </div>
    </SectionShell>
  );
}

function RecordingPlayback({ soundCheck }: SoundCheckProps) {
  const { isHelpModeActive, isHelpModeExiting } = useHelpMode();
  const [enteringClipIds, setEnteringClipIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [exitingClipIds, setExitingClipIds] = useState<Set<string>>(
    () => new Set(),
  );
  const knownClipIdsRef = useRef<Set<string>>(new Set());
  const hasInitialClipSnapshotRef = useRef(false);
  const clipAnimationTimersRef = useRef<Set<number>>(new Set());
  const deleteClipTimersRef = useRef<Map<string, number>>(new Map());
  const deleteAllClipsTimerRef = useRef<number | null>(null);
  const isDeleteAllButtonHoveredRef = useRef(false);
  const deleteAllConfirmTimerRef = useRef<number | null>(null);
  const [deleteAllConfirmingClipIdsKey, setDeleteAllConfirmingClipIdsKey] =
    useState<string | null>(null);
  const shouldShowHelpDemo =
    isHelpModeActive && soundCheck.recordedClips.length === 0;
  const isRenameHelpActive = isHelpModeActive && !isHelpModeExiting;
  const clipIdsKey = soundCheck.recordedClips.map((clip) => clip.id).join('|');
  const isDeleteAllConfirming =
    soundCheck.recordedClips.length > 0 &&
    deleteAllConfirmingClipIdsKey === clipIdsKey;

  useEffect(() => {
    const animationTimers = clipAnimationTimersRef.current;
    const clipIds = new Set(soundCheck.recordedClips.map((clip) => clip.id));
    const previousClipIds = knownClipIdsRef.current;
    const newClipIds = [...clipIds].filter(
      (clipId) => !previousClipIds.has(clipId),
    );

    knownClipIdsRef.current = clipIds;

    if (!hasInitialClipSnapshotRef.current) {
      hasInitialClipSnapshotRef.current = true;
      return undefined;
    }

    if (newClipIds.length === 0) {
      return undefined;
    }

    const enterTimer = window.setTimeout(() => {
      setEnteringClipIds((currentIds) => {
        const nextIds = new Set(currentIds);

        newClipIds.forEach((clipId) => nextIds.add(clipId));

        return nextIds;
      });
    }, 0);
    const clearTimer = window.setTimeout(() => {
      setEnteringClipIds((currentIds) => {
        const nextIds = new Set(currentIds);

        newClipIds.forEach((clipId) => nextIds.delete(clipId));

        return nextIds;
      });
    }, 260);

    animationTimers.add(enterTimer);
    animationTimers.add(clearTimer);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(clearTimer);
      animationTimers.delete(enterTimer);
      animationTimers.delete(clearTimer);
    };
  }, [clipIdsKey, soundCheck.recordedClips]);

  useEffect(() => {
    const animationTimers = clipAnimationTimersRef.current;
    const deleteTimers = deleteClipTimersRef.current;
    const deleteAllClipsTimer = deleteAllClipsTimerRef;
    const deleteAllConfirmTimer = deleteAllConfirmTimerRef;

    return () => {
      animationTimers.forEach((timer) => window.clearTimeout(timer));
      deleteTimers.forEach((timer) => window.clearTimeout(timer));

      if (deleteAllClipsTimer.current !== null) {
        window.clearTimeout(deleteAllClipsTimer.current);
      }

      if (deleteAllConfirmTimer.current !== null) {
        window.clearTimeout(deleteAllConfirmTimer.current);
      }
    };
  }, []);

  function clearDeleteAllConfirmTimer() {
    if (deleteAllConfirmTimerRef.current === null) {
      return;
    }

    window.clearTimeout(deleteAllConfirmTimerRef.current);
    deleteAllConfirmTimerRef.current = null;
  }

  function scheduleDeleteAllConfirmTimeout() {
    clearDeleteAllConfirmTimer();

    if (isDeleteAllButtonHoveredRef.current) {
      return;
    }

    deleteAllConfirmTimerRef.current = window.setTimeout(() => {
      deleteAllConfirmTimerRef.current = null;
      setDeleteAllConfirmingClipIdsKey(null);
    }, 3000);
  }

  function handleDeleteRecordedClip(clipId: string) {
    if (deleteClipTimersRef.current.has(clipId)) {
      return;
    }

    setExitingClipIds((currentIds) => new Set(currentIds).add(clipId));

    const deleteTimer = window.setTimeout(() => {
      deleteClipTimersRef.current.delete(clipId);
      soundCheck.deleteRecordedClip(clipId);
      setExitingClipIds((currentIds) => {
        const nextIds = new Set(currentIds);

        nextIds.delete(clipId);

        return nextIds;
      });
    }, 220);

    deleteClipTimersRef.current.set(clipId, deleteTimer);
  }

  function handleDeleteAllRecordedClips() {
    if (!isDeleteAllConfirming) {
      setDeleteAllConfirmingClipIdsKey(clipIdsKey);
      scheduleDeleteAllConfirmTimeout();
      return;
    }

    clearDeleteAllConfirmTimer();
    deleteClipTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    deleteClipTimersRef.current.clear();
    if (deleteAllClipsTimerRef.current !== null) {
      window.clearTimeout(deleteAllClipsTimerRef.current);
    }

    const clipIds = soundCheck.recordedClips.map((clip) => clip.id);

    setEnteringClipIds(new Set());
    setExitingClipIds(new Set(clipIds));
    setDeleteAllConfirmingClipIdsKey(null);

    deleteAllClipsTimerRef.current = window.setTimeout(() => {
      deleteAllClipsTimerRef.current = null;
      soundCheck.deleteAllRecordedClips();
      setExitingClipIds(new Set());
    }, 220);
  }

  function handleDeleteAllPointerEnter() {
    isDeleteAllButtonHoveredRef.current = true;
    clearDeleteAllConfirmTimer();
  }

  function handleDeleteAllPointerLeave() {
    isDeleteAllButtonHoveredRef.current = false;

    if (isDeleteAllConfirming) {
      scheduleDeleteAllConfirmTimeout();
    }
  }

  const deleteAllAction =
    soundCheck.recordedClips.length > 0 ? (
      <DeleteAllRecordingsButton
        isConfirming={isDeleteAllConfirming}
        onClick={handleDeleteAllRecordedClips}
        onPointerEnter={handleDeleteAllPointerEnter}
        onPointerLeave={handleDeleteAllPointerLeave}
      />
    ) : null;

  return (
    <HelpTarget activeClassName="z-50" className="block">
      <SettingsGroup title="Recorded playback" titleAction={deleteAllAction}>
        <div className="grid gap-2">
          {shouldShowHelpDemo ? (
            <div
              className={joinClasses(
                'recorded-clip-item overflow-hidden',
                isHelpModeExiting
                  ? 'recorded-clip-exiting pointer-events-none'
                  : 'recorded-clip-entering',
              )}
            >
              <div className="recorded-clip-inner min-h-0 overflow-hidden">
                <HelpDemoRecordedClip />
              </div>
            </div>
          ) : soundCheck.recordedClips.length === 0 ? (
            <p className="text-muted text-sm">No recordings yet.</p>
          ) : (
            soundCheck.recordedClips.map((clip, index) => {
              const isActive =
                soundCheck.recordedPlayback.activeClipId === clip.id;
              const isPlaying =
                isActive && soundCheck.recordedPlayback.isPlaying;
              const positionSeconds =
                soundCheck.recordedPlayback.positionsByClipId[clip.id] ?? 0;
              const recordingName = clip.name || 'Recording';
              const shouldShowRenameHelp = isHelpModeActive && index === 0;
              const shouldUnderlineRename = isRenameHelpActive && index === 0;
              const recordingNameInput = (
                <input
                  id={`recorded-clip-name-${clip.id}`}
                  name={`recorded-clip-name-${clip.id}`}
                  type="text"
                  value={clip.name}
                  onChange={(event) =>
                    soundCheck.renameRecordedClip(clip.id, event.target.value)
                  }
                  onFocus={() => soundCheck.selectRecordedClip(clip.id)}
                  onPointerDown={() => soundCheck.selectRecordedClip(clip.id)}
                  placeholder="Recording"
                  aria-label="Rename recording"
                  title="Rename recording"
                  className={joinClasses(
                    'text-foreground focus:border-b-output h-7 w-full min-w-0 border-b border-transparent bg-transparent px-0 text-sm leading-tight transition focus:ring-0 focus:outline-none',
                    shouldUnderlineRename && 'border-b-output/80',
                  )}
                />
              );

              return (
                <div
                  key={clip.id}
                  className={joinClasses(
                    'recorded-clip-item overflow-hidden',
                    enteringClipIds.has(clip.id) && 'recorded-clip-entering',
                    exitingClipIds.has(clip.id) &&
                      'recorded-clip-exiting pointer-events-none',
                  )}
                >
                  <div className="recorded-clip-inner min-h-0 overflow-hidden">
                    <div className="grid gap-3 py-2">
                      <div className="grid gap-2">
                        {shouldShowRenameHelp ? (
                          <HelpTip
                            className="w-full"
                            label="Clips can be renamed"
                            placement="top"
                            tipClassName="[--help-tip-gap:0.375rem]"
                          >
                            {recordingNameInput}
                          </HelpTip>
                        ) : (
                          recordingNameInput
                        )}
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
                          soundCheck.handleRecordedClipSeek(
                            clip.id,
                            nextPosition,
                          );
                        }}
                        onToggle={() => {
                          soundCheck.selectRecordedClip(clip.id);
                          soundCheck.toggleRecordedClipPlayback(clip.id);
                        }}
                        positionSeconds={positionSeconds}
                        sideControls={
                          <PlaybackIconButton
                            label={`Delete ${recordingName}`}
                            onClick={() => handleDeleteRecordedClip(clip.id)}
                            tone="danger"
                          >
                            <TrashIcon aria-hidden="true" className="h-5 w-5" />
                          </PlaybackIconButton>
                        }
                        seekLabel={`${recordingName} playback position`}
                        seekName={`recorded-clip-position-${clip.id}`}
                      />
                    </div>
                    {index < soundCheck.recordedClips.length - 1 ? (
                      <hr className="border-line -mx-1 mt-2 border-t" />
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SettingsGroup>
    </HelpTarget>
  );
}

function DeleteAllRecordingsButton({
  isConfirming,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: {
  isConfirming: boolean;
  onClick: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const label = isConfirming
    ? 'Confirm delete all recordings'
    : 'Delete all recordings';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={joinClasses(
        'inline-flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-transparent text-sm font-semibold whitespace-nowrap transition-[width,background-color,color,scale,translate] duration-200 ease-out select-none focus:outline-none active:translate-y-px active:scale-95',
        isConfirming
          ? 'text-danger hover:bg-danger/8 bg-danger/8 hover:text-danger w-[5.75rem] px-2'
          : 'text-muted hover:bg-danger/8 hover:text-danger w-[5.75rem] pr-2 pl-3.5',
      )}
    >
      {isConfirming ? (
        <span className="px-1">Confirm?</span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <span>Clear</span>
          <TrashIcon aria-hidden="true" className="h-5 w-5" />
        </span>
      )}
    </button>
  );
}

function HelpDemoRecordedClip() {
  const { isHelpModeActive, isHelpModeExiting } = useHelpMode();
  const [name, setName] = useState('Help demo recording');
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const isRenameHelpActive = isHelpModeActive && !isHelpModeExiting;

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setPositionSeconds((currentPosition) => {
        const nextPosition = Math.min(
          HELP_DEMO_RECORDING_DURATION_SECONDS,
          currentPosition + 0.1,
        );

        if (nextPosition >= HELP_DEMO_RECORDING_DURATION_SECONDS) {
          setIsPlaying(false);
        }

        return nextPosition;
      });
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [isPlaying]);

  return (
    <div className="grid gap-3 py-2">
      <div className="grid gap-2">
        <HelpTip
          className="w-full"
          label="Clips can be renamed"
          placement="top"
          tipClassName="[--help-tip-gap:0.375rem]"
          bubbleClassName="-mt-2"
        >
          <input
            id="help-demo-recorded-clip-name"
            name="help-demo-recorded-clip-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Recording"
            aria-label="Rename demo recording"
            title="Rename demo recording"
            className={joinClasses(
              'text-foreground focus:border-b-output h-7 w-full min-w-0 border-b border-transparent bg-transparent px-0 text-sm leading-tight transition focus:ring-0 focus:outline-none',
              isRenameHelpActive && 'border-b-output/80',
            )}
          />
        </HelpTip>
        <span className="text-muted block text-xs">
          Device: Help mode sample
        </span>
      </div>
      <AudioPlaybackControls
        buttonLabel={isPlaying ? `Pause ${name}` : `Play ${name}`}
        canUseTransport
        durationSeconds={HELP_DEMO_RECORDING_DURATION_SECONDS}
        isPlaying={isPlaying}
        onSeek={setPositionSeconds}
        onToggle={() => setIsPlaying((current) => !current)}
        positionSeconds={positionSeconds}
        sideControls={
          <PlaybackIconButton
            disabled
            label="Demo recording cannot be deleted"
            onClick={() => undefined}
            tone="danger"
          >
            <TrashIcon aria-hidden="true" className="h-5 w-5" />
          </PlaybackIconButton>
        }
        seekLabel="Demo recording playback position"
        seekName="help-demo-recorded-clip-position"
      />
    </div>
  );
}

function DialUpConfig({ soundCheck }: SoundCheckProps) {
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
      onToggle={soundCheck.toggleMusicPlayback}
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
  soundCheck,
}: SoundCheckProps & {
  musicFileInputRef: RefObject<HTMLInputElement | null>;
  onMusicQualityChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onMusicSourceChange: (event: ChangeEvent<HTMLSelectElement>) => void;
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
          onToggle={soundCheck.toggleMusicPlayback}
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
