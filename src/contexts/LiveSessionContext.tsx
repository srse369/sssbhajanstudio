import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import type { Song } from '../lib/songs';

const LIVE_SESSION_KEY = 'sai-bhajans:live-session';

export interface LiveSessionItem {
  songId: string;
  songName: string;
  singerId?: string;
  singerName?: string;
  singerGender?: string;
  pitch?: string;
  language?: string | null;
  deity?: string | null;
}

export function liveSessionItemKey(item: Pick<LiveSessionItem, 'songId' | 'singerId'>) {
  return `${item.songId}|${item.singerId || 'none'}`;
}

interface LiveSessionSongDetails {
  singerId?: string;
  singerName?: string;
  singerGender?: string;
  pitch?: string;
}

interface LiveSessionValue {
  items: LiveSessionItem[];
  isLoading: boolean;
  addSong: (song: Pick<Song, 'id' | 'name' | 'language' | 'deity'>, details?: LiveSessionSongDetails) => Promise<void>;
  removeSong: (songId: string, singerId?: string) => Promise<void>;
  removeItem: (itemKey: string) => Promise<void>;
  moveSong: (itemKey: string, direction: -1 | 1) => Promise<void>;
  moveSongTo: (itemKey: string, position: 'top' | 'bottom') => Promise<void>;
  replaceItems: (items: LiveSessionItem[]) => Promise<void>;
  clearSession: () => Promise<void>;
}

const LiveSessionContext = createContext<LiveSessionValue | null>(null);

export function LiveSessionProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<LiveSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const itemsRef = useRef<LiveSessionItem[]>([]);
  const isHydratedRef = useRef(false);

  useEffect(() => {
    let isActive = true;
    void AsyncStorage.getItem(LIVE_SESSION_KEY)
      .then((storedItems) => {
        if (!isActive || !storedItems) return;
        const parsed: unknown = JSON.parse(storedItems);
        if (!Array.isArray(parsed)) return;
        const validItems = parsed.flatMap((item): LiveSessionItem[] => {
          if (typeof item !== 'object' || item === null) return [];
          const row = item as Partial<LiveSessionItem>;
          if (typeof row.songId !== 'string' || typeof row.songName !== 'string') return [];
          if (row.singerId != null && typeof row.singerId !== 'string') return [];
          return [{
            songId: row.songId,
            songName: row.songName,
            singerId: row.singerId,
            singerName: row.singerName,
            singerGender: row.singerGender,
            pitch: row.pitch,
            language: row.language,
            deity: row.deity,
          }];
        });
        itemsRef.current = validItems;
        setItems(validItems);
      })
      .catch(() => {
        void AsyncStorage.removeItem(LIVE_SESSION_KEY);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
          isHydratedRef.current = true;
        }
      });
    return () => {
      isActive = false;
    };
  }, []);

  const commitItems = useCallback((nextItems: LiveSessionItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
    return isHydratedRef.current
      ? AsyncStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(nextItems))
      : Promise.resolve();
  }, []);

  const addSong = useCallback((song: Pick<Song, 'id' | 'name' | 'language' | 'deity'>, details: LiveSessionSongDetails = {}) => {
    const nextItem: LiveSessionItem = {
      songId: song.id,
      songName: song.name,
      language: song.language,
      deity: song.deity,
      ...details,
    };
    const current = itemsRef.current;
    const existingIndex = current.findIndex((item) => liveSessionItemKey(item) === liveSessionItemKey(nextItem));
    if (existingIndex < 0) return commitItems([...current, nextItem]);
    const updated = [...current];
    updated[existingIndex] = { ...updated[existingIndex], ...nextItem, pitch: details.pitch ?? updated[existingIndex].pitch };
    return commitItems(updated);
  }, [commitItems]);

  const removeSong = useCallback((songId: string, singerId?: string) => {
    return commitItems(itemsRef.current.filter((item) => singerId
      ? !(item.songId === songId && item.singerId === singerId)
      : item.songId !== songId));
  }, [commitItems]);

  const removeItem = useCallback((itemKey: string) => {
    return commitItems(itemsRef.current.filter((item) => liveSessionItemKey(item) !== itemKey));
  }, [commitItems]);

  const moveSong = useCallback((itemKey: string, direction: -1 | 1) => {
    const current = itemsRef.current;
    const index = current.findIndex((item) => liveSessionItemKey(item) === itemKey);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return Promise.resolve();
    const reordered = [...current];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    return commitItems(reordered);
  }, [commitItems]);

  const moveSongTo = useCallback((itemKey: string, position: 'top' | 'bottom') => {
    const current = itemsRef.current;
    const index = current.findIndex((item) => liveSessionItemKey(item) === itemKey);
    if (index < 0 || (position === 'top' && index === 0) || (position === 'bottom' && index === current.length - 1)) {
      return Promise.resolve();
    }

    const reordered = [...current];
    const [item] = reordered.splice(index, 1);
    reordered.splice(position === 'top' ? 0 : reordered.length, 0, item);
    return commitItems(reordered);
  }, [commitItems]);

  const clearSession = useCallback(() => {
    return commitItems([]);
  }, [commitItems]);

  const replaceItems = useCallback((nextItems: LiveSessionItem[]) => {
    return commitItems(nextItems);
  }, [commitItems]);

  const value = useMemo(
    () => ({ items, isLoading, addSong, removeSong, removeItem, moveSong, moveSongTo, replaceItems, clearSession }),
    [items, isLoading, addSong, removeSong, removeItem, moveSong, moveSongTo, replaceItems, clearSession],
  );

  return (
    <LiveSessionContext.Provider value={value}>
      {children}
    </LiveSessionContext.Provider>
  );
}

export function useLiveSession() {
  const context = useContext(LiveSessionContext);
  if (!context) throw new Error('useLiveSession must be used within LiveSessionProvider.');
  return context;
}