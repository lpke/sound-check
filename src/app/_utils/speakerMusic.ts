import type { SpeakerMusicSource, SpeakerMusicTrackId } from './types';

export const speakerMusicTracks = {
  blindingLights: {
    label: 'Blinding Lights',
    path: '/audio/blinding-lights.flac',
  },
  evilManBlues: {
    label: 'Evil Man Blues',
    path: '/audio/evil-man-blues.flac',
  },
} as const satisfies Record<
  SpeakerMusicTrackId,
  { label: string; path: string }
>;

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
