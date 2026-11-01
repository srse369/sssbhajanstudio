import * as Linking from 'expo-linking';
import type { LiveSessionItem } from '../contexts/LiveSessionContext';
import { formatReferencePitch } from './pitch';

type CompactItem = [songId: string, songName: string, singerId: string, singerName: string, gender: string, pitch: string];

export function buildLiveShareMessage(items: LiveSessionItem[]) {
  const compact: CompactItem[] = items.map((item) => [
    item.songId, item.songName, item.singerId || '', item.singerName || '', item.singerGender || '', item.pitch || '',
  ]);
  const link = Linking.createURL('/import-live', { scheme: 'sssbhajanstudio', queryParams: { q: JSON.stringify(compact) } });
  const lines = items.map((item, index) => {
    const detail = [item.singerName, item.pitch ? formatReferencePitch(item.pitch) || item.pitch : null].filter(Boolean).join(': ');
    return `${index + 1}. ${item.songName}${detail ? ` – ${detail}` : ''}`;
  });
  return [
    `Live session (${items.length} ${items.length === 1 ? 'song' : 'songs'})`,
    ...lines,
    '',
    `Open in SSS Bhajan Studio: ${link}`,
  ].join('\n');
}

export function parseLiveShare(value: string | undefined): LiveSessionItem[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row): LiveSessionItem[] => {
      if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'string') return [];
      const text = (index: number) => (typeof row[index] === 'string' && row[index] ? row[index] as string : undefined);
      return [{
        songId: row[0], songName: row[1], singerId: text(2), singerName: text(3), singerGender: text(4), pitch: text(5),
      }];
    });
  } catch {
    return [];
  }
}
