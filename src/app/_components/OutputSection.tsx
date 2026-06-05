import { useRef, type ChangeEvent, type RefObject } from 'react';
import type { SpeakerMusicSource, SpeakerTestKind } from '@/utils/types';
import { formatSeconds, joinClasses } from '@/utils/utils';
import type { SoundCheckProps } from './componentTypes';
import { controlClassName } from './controlStyles';
import {
  BookmarkIcon,
  ChevronDownIcon,
  SpeakerIcon,
  TrashIcon,
  XIcon,
} from './icons';
import { AudioPlaybackControls, PlaybackIconButton } from './playbackControls';
import { RangeWithUnit } from './RangeWithUnit';
import { SectionHeader, SectionShell } from './sectionChrome';
import { SettingsGroup } from './settingsGroup';
import { Button, Field, LevelMeter } from './ui';

const speakerTestOptions: { kind: SpeakerTestKind; label: string }[] = [
  { kind: 'tone', label: 'Steady tone' },
  { kind: 'modulatedTone', label: 'Modulating tone' },
  { kind: 'sweep', label: 'Frequency sweep' },
  { kind: 'music', label: 'Music' },
];

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
        signalLevel={soundCheck.outputLevel}
        signalState={soundCheck.outputSignalState}
        toggleLabel={isOutputStopped ? 'Unmute speaker' : 'Mute speaker'}
      />
      <LevelMeter
        accent="output"
        level={soundCheck.outputLevel}
        spectrum={soundCheck.outputSpectrum}
        spectrumPeaks={soundCheck.outputSpectrumPeaks}
      />

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
                  onMusicSourceChange={handleMusicSourceChange}
                  soundCheck={soundCheck}
                />
              </>
            ) : (
              <div>
                <Button
                  variant="outputPrimary"
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
                    sideControls={
                      <PlaybackIconButton
                        label={`Delete ${recordingName}`}
                        onClick={() => soundCheck.deleteRecordedClip(clip.id)}
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
            );
          })
        )}
      </div>
    </SettingsGroup>
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
  const { durationSeconds, isLoading, isPlaying, marks, positionSeconds } =
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
        buttonLabel={
          isLoading ? 'Loading music' : isPlaying ? 'Pause music' : 'Play music'
        }
        canUseTransport={canUseTransport}
        centerControls={
          <PlaybackIconButton
            disabled={!hasLoadedMusic}
            label="Mark current position"
            onClick={soundCheck.markMusicPosition}
            className="mr-1 -ml-2.5 !h-8 !w-8 hover:scale-95"
            tone="output"
          >
            <BookmarkIcon aria-hidden="true" className="h-5 w-5" />
          </PlaybackIconButton>
        }
        durationSeconds={durationSeconds}
        isLoading={isLoading}
        isPlaying={isPlaying}
        markers={marks.map((mark) => ({
          id: mark.id,
          label: `Mark at ${formatSeconds(mark.seconds)}`,
          seconds: mark.seconds,
        }))}
        onSeek={soundCheck.handleMusicSeek}
        onToggle={soundCheck.toggleMusicPlayback}
        positionSeconds={positionSeconds}
        seekLabel="Music playback position"
        seekName="music-playback-position"
      />

      {marks.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {marks.map((mark) => (
            <span
              key={mark.id}
              className="border-output/25 bg-output-soft text-output inline-flex h-9 overflow-hidden rounded-lg border text-xs font-semibold"
            >
              <button
                type="button"
                className="hover:bg-output-soft/70 flex h-full items-center px-3 font-mono transition focus:outline-none active:translate-y-px active:scale-[0.985] disabled:opacity-50 disabled:active:translate-y-0 disabled:active:scale-100"
                title={`Play from ${formatSeconds(mark.seconds)}`}
                onClick={() => soundCheck.playMusicFromMark(mark.seconds)}
                disabled={
                  soundCheck.appPaused ||
                  soundCheck.outputMuted ||
                  !hasLoadedMusic
                }
              >
                {formatSeconds(mark.seconds)}
              </button>
              <button
                type="button"
                aria-label={`Delete mark at ${formatSeconds(mark.seconds)}`}
                title={`Delete mark at ${formatSeconds(mark.seconds)}`}
                className="border-output/20 hover:bg-output/8 text-output/60 hover:text-output flex h-full w-8 items-center justify-center border-l transition focus:outline-none active:translate-y-px active:scale-[0.95]"
                onClick={() => soundCheck.deleteMusicMark(mark.id)}
              >
                <XIcon aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function usesToneFrequency(kind: SpeakerTestKind) {
  return kind === 'tone' || kind === 'modulatedTone' || kind === 'sweep';
}
