import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_CALL_AUDIO_BITRATE_KBPS,
  formatBitrateKbps,
  MAX_AUDIO_BITRATE_KBPS,
  MIN_AUDIO_BITRATE_KBPS,
} from '@/utils/audioBitrate';
import { joinClasses } from '@/utils/utils';
import type { SoundCheckProps } from './componentTypes';
import { useHelpMode } from '@/hooks/useHelpMode';
import { HelpTarget, HelpTip } from './HelpMode';
import { DuplicateIcon, TrashIcon } from './Icons';
import { AudioPlaybackControls, PlaybackIconButton } from './PlaybackControls';
import { RangeWithUnit } from './RangeWithUnit';
import { SettingsGroup } from './SettingsGroup';

const HELP_DEMO_RECORDING_DURATION_SECONDS = 5;

type RecordingCloneDraft = {
  bitrateKbps: number;
  id: string;
  maxBitrateKbps: number;
  name: string;
  phase: 'editing' | 'encoding';
  progressPercent: number;
  sourceClipId: string;
};

export function RecordingPlayback({
  onPlaybackActivate,
  qualityNotice,
  soundCheck,
}: SoundCheckProps & {
  onPlaybackActivate: () => void;
  qualityNotice: ReactNode;
}) {
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
  const committingCloneDraftIdsRef = useRef<Set<string>>(new Set());
  const cloneDraftAbortControllersRef = useRef<Map<string, AbortController>>(
    new Map(),
  );
  const [deleteAllConfirmingClipIdsKey, setDeleteAllConfirmingClipIdsKey] =
    useState<string | null>(null);
  const [cloneDrafts, setCloneDrafts] = useState<RecordingCloneDraft[]>([]);
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
    const cloneDraftAbortControllers = cloneDraftAbortControllersRef.current;

    return () => {
      animationTimers.forEach((timer) => window.clearTimeout(timer));
      deleteTimers.forEach((timer) => window.clearTimeout(timer));
      cloneDraftAbortControllers.forEach((abortController) => {
        abortController.abort();
      });
      cloneDraftAbortControllers.clear();

      if (deleteAllClipsTimer.current !== null) {
        window.clearTimeout(deleteAllClipsTimer.current);
      }

      if (deleteAllConfirmTimer.current !== null) {
        window.clearTimeout(deleteAllConfirmTimer.current);
      }
    };
  }, []);

  function cancelCloneDraft(draftId: string) {
    const abortController = cloneDraftAbortControllersRef.current.get(draftId);

    abortController?.abort();
    cloneDraftAbortControllersRef.current.delete(draftId);
    committingCloneDraftIdsRef.current.delete(draftId);
    setCloneDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => draft.id !== draftId),
    );
  }

  function cancelCloneDraftsForClip(clipId: string) {
    setCloneDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => {
        if (draft.sourceClipId !== clipId) {
          return true;
        }

        const abortController = cloneDraftAbortControllersRef.current.get(
          draft.id,
        );

        abortController?.abort();
        cloneDraftAbortControllersRef.current.delete(draft.id);
        committingCloneDraftIdsRef.current.delete(draft.id);

        return false;
      }),
    );
  }

  function cancelAllCloneDrafts() {
    cloneDraftAbortControllersRef.current.forEach((abortController) => {
      abortController.abort();
    });
    cloneDraftAbortControllersRef.current.clear();
    committingCloneDraftIdsRef.current.clear();
    setCloneDrafts([]);
  }

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

    cancelCloneDraftsForClip(clipId);
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
    cancelAllCloneDrafts();
    setDeleteAllConfirmingClipIdsKey(null);

    deleteAllClipsTimerRef.current = window.setTimeout(() => {
      deleteAllClipsTimerRef.current = null;
      soundCheck.deleteAllRecordedClips();
      setExitingClipIds(new Set());
    }, 220);
  }

  function handleStartDuplicate(clip: (typeof soundCheck.recordedClips)[0]) {
    const maxBitrateKbps = clampCloneBitrateKbps(
      clip.averageBitrateKbps ?? DEFAULT_CALL_AUDIO_BITRATE_KBPS,
      MAX_AUDIO_BITRATE_KBPS,
    );
    const originalAverageBitrateKbps =
      clip.originalAverageBitrateKbps ?? clip.averageBitrateKbps;
    const defaultBitrateKbps = clampCloneBitrateKbps(
      originalAverageBitrateKbps ?? DEFAULT_CALL_AUDIO_BITRATE_KBPS,
      maxBitrateKbps,
    );

    setCloneDrafts((currentDrafts) => {
      if (currentDrafts.some((draft) => draft.sourceClipId === clip.id)) {
        return currentDrafts;
      }

      return [
        ...currentDrafts,
        {
          bitrateKbps: defaultBitrateKbps,
          id: `clone-${clip.id}-${Date.now()}`,
          maxBitrateKbps,
          name: getDuplicateRecordingName(
            clip.name || 'Recording',
            soundCheck.recordedClips,
            currentDrafts,
          ),
          phase: 'editing',
          progressPercent: 0,
          sourceClipId: clip.id,
        },
      ];
    });
  }

  function handleCloneBitrateChange(draftId: string, bitrateKbps: number) {
    setCloneDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              bitrateKbps: clampCloneBitrateKbps(
                bitrateKbps,
                draft.maxBitrateKbps,
              ),
            }
          : draft,
      ),
    );
  }

  function commitCloneDraft(draftId: string, nextBitrateKbps?: number) {
    if (committingCloneDraftIdsRef.current.has(draftId)) {
      return;
    }

    const draft = cloneDrafts.find(
      (currentDraft) => currentDraft.id === draftId,
    );

    if (!draft || draft.phase === 'encoding') {
      return;
    }

    const bitrateKbps = clampCloneBitrateKbps(
      nextBitrateKbps ?? draft.bitrateKbps,
      draft.maxBitrateKbps,
    );
    const abortController = new AbortController();

    committingCloneDraftIdsRef.current.add(draftId);
    cloneDraftAbortControllersRef.current.set(draftId, abortController);
    setCloneDrafts((currentDrafts) =>
      currentDrafts.map((currentDraft) =>
        currentDraft.id === draftId
          ? {
              ...currentDraft,
              bitrateKbps,
              phase: 'encoding',
              progressPercent: 0,
            }
          : currentDraft,
      ),
    );

    void soundCheck
      .duplicateRecordedClipWithBitrate({
        bitrateKbps,
        clipId: draft.sourceClipId,
        name: draft.name,
        onProgress: (progressPercent) => {
          setCloneDrafts((currentDrafts) =>
            currentDrafts.map((currentDraft) =>
              currentDraft.id === draftId
                ? { ...currentDraft, progressPercent }
                : currentDraft,
            ),
          );
        },
        signal: abortController.signal,
      })
      .then(() => {
        setCloneDrafts((currentDrafts) =>
          currentDrafts.filter((currentDraft) => currentDraft.id !== draftId),
        );
      })
      .catch(() => {
        setCloneDrafts((currentDrafts) =>
          currentDrafts.map((currentDraft) =>
            currentDraft.id === draftId
              ? { ...currentDraft, phase: 'editing', progressPercent: 0 }
              : currentDraft,
          ),
        );
      })
      .finally(() => {
        committingCloneDraftIdsRef.current.delete(draftId);
        cloneDraftAbortControllersRef.current.delete(draftId);
      });
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
      <SettingsGroup
        className="relative [&_.settings-group-title-action]:absolute [&_.settings-group-title-action]:top-4 [&_.settings-group-title-action]:right-4 [&_[data-settings-group-description=true]]:!mt-4 sm:[&_[data-settings-group-description=true]]:!mt-1 [&>div:first-child]:mb-3 [&>div:first-child>div:first-child]:pr-24"
        title="Recorded playback"
        animateDescription
        description={qualityNotice}
        titleAction={deleteAllAction}
      >
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
            <p className="text-muted pt-2 text-sm">No recordings yet.</p>
          ) : (
            soundCheck.recordedClips.map((clip, index) => {
              const isActive =
                soundCheck.recordedPlayback.activeClipId === clip.id;
              const isPlaying =
                isActive && soundCheck.recordedPlayback.isPlaying;
              const positionSeconds =
                soundCheck.recordedPlayback.positionsByClipId[clip.id] ?? 0;
              const recordingName = clip.name || 'Recording';
              const encodingProgress =
                soundCheck.encodingRecordedClipProgressById[clip.id];
              const isEncodingRecording = encodingProgress !== undefined;
              const bitrateChangeLabel = getBitrateChangeLabel({
                bitrateModified: clip.bitrateModified,
                originalAverageBitrateKbps: clip.originalAverageBitrateKbps,
              });
              const clipCloneDrafts = cloneDrafts.filter(
                (draft) => draft.sourceClipId === clip.id,
              );
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
                <Fragment key={clip.id}>
                  <div
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
                            title={`${clip.inputDeviceName}, ${formatBitrateKbps(
                              clip.averageBitrateKbps,
                            )}${bitrateChangeLabel}`}
                          >
                            Device: {clip.inputDeviceName}, Avg Bitrate:{' '}
                            {formatBitrateKbps(clip.averageBitrateKbps)}
                            {bitrateChangeLabel}
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
                            clip.durationSeconds > 0 &&
                            !isEncodingRecording
                          }
                          durationSeconds={clip.durationSeconds}
                          isLoading={isEncodingRecording}
                          isPlaying={isPlaying}
                          loadingProgressPercent={encodingProgress ?? null}
                          onSeek={(nextPosition) => {
                            soundCheck.selectRecordedClip(clip.id);
                            soundCheck.handleRecordedClipSeek(
                              clip.id,
                              nextPosition,
                            );
                          }}
                          onToggle={() => {
                            onPlaybackActivate();
                            soundCheck.selectRecordedClip(clip.id);
                            soundCheck.toggleRecordedClipPlayback(clip.id);
                          }}
                          positionSeconds={positionSeconds}
                          sideControls={
                            <>
                              <PlaybackIconButton
                                disabled={isEncodingRecording}
                                label={`Duplicate ${recordingName}`}
                                onClick={() => handleStartDuplicate(clip)}
                                tone="mutedOutput"
                              >
                                <DuplicateIcon
                                  aria-hidden="true"
                                  className="h-5 w-5"
                                />
                              </PlaybackIconButton>
                              <PlaybackIconButton
                                label={`Delete ${recordingName}`}
                                onClick={() =>
                                  handleDeleteRecordedClip(clip.id)
                                }
                                tone="danger"
                              >
                                <TrashIcon
                                  aria-hidden="true"
                                  className="h-5 w-5"
                                />
                              </PlaybackIconButton>
                            </>
                          }
                          seekLabel={`${recordingName} playback position`}
                          seekName={`recorded-clip-position-${clip.id}`}
                        />
                      </div>
                      {index < soundCheck.recordedClips.length - 1 ||
                      clipCloneDrafts.length > 0 ? (
                        <hr className="border-line -mx-1 mt-2 border-t" />
                      ) : null}
                    </div>
                  </div>
                  {clipCloneDrafts.map((draft, draftIndex) => (
                    <RecordingCloneDraftItem
                      key={draft.id}
                      draft={draft}
                      inputDeviceName={clip.inputDeviceName}
                      isLastItem={
                        index === soundCheck.recordedClips.length - 1 &&
                        draftIndex === clipCloneDrafts.length - 1
                      }
                      onBitrateChange={(bitrateKbps) =>
                        handleCloneBitrateChange(draft.id, bitrateKbps)
                      }
                      onCommit={(bitrateKbps) =>
                        commitCloneDraft(draft.id, bitrateKbps)
                      }
                      onCancel={() => cancelCloneDraft(draft.id)}
                    />
                  ))}
                </Fragment>
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
        'inline-flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-semibold whitespace-nowrap transition-[width,background-color,color,scale,translate] duration-200 ease-out select-none focus:outline-none active:translate-y-px active:scale-95',
        isConfirming
          ? 'bg-danger/8 text-danger hover:bg-danger/8 hover:text-danger w-[5.75rem] px-2'
          : 'text-muted hover:bg-danger/8 hover:text-danger w-[5.75rem] bg-transparent pr-2 pl-3.5',
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

function RecordingCloneDraftItem({
  draft,
  inputDeviceName,
  isLastItem,
  onCancel,
  onBitrateChange,
  onCommit,
}: {
  draft: RecordingCloneDraft;
  inputDeviceName: string;
  isLastItem: boolean;
  onCancel: () => void;
  onBitrateChange: (bitrateKbps: number) => void;
  onCommit: (bitrateKbps: number) => void;
}) {
  const isEncoding = draft.phase === 'encoding';

  return (
    <div className="recorded-clip-item recorded-clip-entering overflow-hidden">
      <div className="recorded-clip-inner min-h-0 overflow-hidden">
        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <input
              type="text"
              value={draft.name}
              disabled
              aria-label="Duplicate recording name"
              className="text-muted h-7 w-full min-w-0 border-b border-transparent bg-transparent px-0 text-sm leading-tight transition disabled:opacity-100"
            />
            <span className="text-muted block text-xs">
              Device: {inputDeviceName}, Avg Bitrate: pending
            </span>
          </div>
          <RangeWithUnit
            accent="output"
            ariaLabel={`Duplicate ${draft.name} bitrate in kilobits per second`}
            commitOnRangeChange={false}
            disabled={isEncoding}
            focusOnMount={draft.phase === 'editing'}
            idBase={`recording-clone-bitrate-${draft.id}`}
            label="Bitrate"
            max={draft.maxBitrateKbps}
            min={MIN_AUDIO_BITRATE_KBPS}
            step={1}
            showHelpLabel={false}
            showLabel={false}
            unit="kbps"
            value={draft.bitrateKbps}
            onChange={onBitrateChange}
            onCommit={onCommit}
          />
          <AudioPlaybackControls
            buttonLabel={
              isEncoding
                ? `Encoding ${draft.name}`
                : `${draft.name} is waiting for bitrate`
            }
            canUseTransport={false}
            durationSeconds={0}
            isLoading={isEncoding}
            isPlaying={false}
            loadingProgressPercent={isEncoding ? draft.progressPercent : null}
            onSeek={() => undefined}
            onToggle={() => undefined}
            positionSeconds={0}
            seekLabel={`${draft.name} playback position`}
            seekName={`recorded-clip-position-${draft.id}`}
            sideControls={
              <>
                <PlaybackIconButton
                  disabled
                  label="Duplicate options unavailable while cloning"
                  onClick={() => undefined}
                  tone="mutedOutput"
                >
                  <DuplicateIcon aria-hidden="true" className="h-5 w-5" />
                </PlaybackIconButton>
                <PlaybackIconButton
                  label={`Cancel duplicate ${draft.name}`}
                  onClick={onCancel}
                  onPointerDown={(event) => event.preventDefault()}
                  tone="danger"
                >
                  <TrashIcon aria-hidden="true" className="h-5 w-5" />
                </PlaybackIconButton>
              </>
            }
          />
        </div>
        {!isLastItem ? (
          <hr className="border-line -mx-1 mt-2 border-t" />
        ) : null}
      </div>
    </div>
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
          Device: Help mode sample, Avg Bitrate: 96 kbps
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

function clampCloneBitrateKbps(value: number, maxBitrateKbps: number) {
  const boundedMaxBitrateKbps = Math.max(
    MIN_AUDIO_BITRATE_KBPS,
    Math.min(MAX_AUDIO_BITRATE_KBPS, Math.round(maxBitrateKbps)),
  );
  const nextBitrateKbps = Number.isFinite(value)
    ? value
    : boundedMaxBitrateKbps;

  return Math.round(
    Math.min(
      Math.max(nextBitrateKbps, MIN_AUDIO_BITRATE_KBPS),
      boundedMaxBitrateKbps,
    ),
  );
}

function getDuplicateRecordingName(
  baseName: string,
  clips: { name: string }[],
  drafts: { name: string }[],
) {
  const usedNames = new Set([
    ...clips.map((clip) => clip.name),
    ...drafts.map((draft) => draft.name),
  ]);
  let duplicateIndex = 1;
  let duplicateName = `${baseName} (${duplicateIndex})`;

  while (usedNames.has(duplicateName)) {
    duplicateIndex += 1;
    duplicateName = `${baseName} (${duplicateIndex})`;
  }

  return duplicateName;
}

function getBitrateChangeLabel({
  bitrateModified,
  originalAverageBitrateKbps,
}: {
  bitrateModified: boolean;
  originalAverageBitrateKbps: number | null;
}) {
  if (!bitrateModified) {
    return '';
  }

  return ` (from ${formatBitrateKbps(originalAverageBitrateKbps)})`;
}
