import { Share } from 'react-native';
import * as Linking from 'expo-linking';
import { formatReferencePitch } from './pitch';
import type { Song } from './songs';

export function shareSong(song: Song) {
  const pitches = [
    song.refGents ? `Gents: ${formatReferencePitch(song.refGents)}` : null,
    song.refLadies ? `Ladies: ${formatReferencePitch(song.refLadies)}` : null,
  ].filter(Boolean).join(' • ');
  const link = Linking.createURL(`/song/${encodeURIComponent(song.id)}`, { scheme: 'sssbhajanstudio' });
  const message = [song.name, pitches, `Open in SSS Bhajan Studio: ${link}`, song.externalSourceUrl].filter(Boolean).join('\n');
  return Share.share({ message });
}
