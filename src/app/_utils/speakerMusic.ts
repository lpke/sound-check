import { generatedSpeakerMusicTracks } from './speakerMusic.generated';
import type {
  SpeakerMusicQuality,
  SpeakerMusicSource,
  SpeakerMusicTrackId,
} from './types';

type SpeakerMusicTrackQuality = {
  format: SpeakerMusicQuality;
  path: string;
  sizeBytes: number;
};

type SpeakerMusicTrack = {
  label: string;
  qualities: Partial<Record<SpeakerMusicQuality, SpeakerMusicTrackQuality>>;
};

export type SpeakerMusicQualityOption = SpeakerMusicTrackQuality & {
  displayLabel: string;
};

const musicQualityLabels = {
  flac: 'FLAC',
  mp3: 'MP3',
} as const satisfies Record<SpeakerMusicQuality, string>;

const musicQualityOrder = [
  'flac',
  'mp3',
] as const satisfies ReadonlyArray<SpeakerMusicQuality>;

export const speakerMusicTracks: Record<
  SpeakerMusicTrackId,
  SpeakerMusicTrack
> = generatedSpeakerMusicTracks;

export const speakerMusicSources = [
  {
    label: speakerMusicTracks.blindingLights.label,
    source: 'blindingLights',
  },
  {
    label: speakerMusicTracks.evilManBlues.label,
    source: 'evilManBlues',
  },
  {
    label: 'Audio file',
    source: 'file',
  },
] as const satisfies ReadonlyArray<{
  label: string;
  source: SpeakerMusicSource;
}>;

export function getDefaultMusicQuality(musicSource: SpeakerMusicSource) {
  if (musicSource === 'file') {
    return 'flac';
  }

  const qualities = speakerMusicTracks[musicSource].qualities;

  return qualities.flac?.format ?? getFirstAvailableQuality(qualities);
}

export function getSpeakerMusicQualityOption(
  musicSource: SpeakerMusicSource,
  musicQuality: SpeakerMusicQuality,
) {
  return (
    getSpeakerMusicQualityOptions(musicSource).find(
      (qualityOption) => qualityOption.format === musicQuality,
    ) ?? null
  );
}

export function getSpeakerMusicQualityOptions(
  musicSource: SpeakerMusicSource,
): SpeakerMusicQualityOption[] {
  if (musicSource === 'file') {
    return [];
  }

  const qualities = speakerMusicTracks[musicSource].qualities;

  return musicQualityOrder.flatMap((quality) => {
    const qualityOption = qualities[quality];

    if (!qualityOption) {
      return [];
    }

    return [
      {
        ...qualityOption,
        displayLabel: `${musicQualityLabels[quality]} (${formatMegabytes(
          qualityOption.sizeBytes,
        )})`,
      },
    ];
  });
}

function getFirstAvailableQuality(
  qualities: SpeakerMusicTrack['qualities'],
): SpeakerMusicQuality {
  const firstAvailableQuality = musicQualityOrder.find(
    (quality) => qualities[quality],
  );

  if (!firstAvailableQuality) {
    throw new Error('Music track has no available quality options.');
  }

  return firstAvailableQuality;
}

function formatMegabytes(sizeBytes: number) {
  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`;
}
