import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, Music2 } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { colors } from '../../lib/theme';
import { singerNameColor } from '../../lib/singerColors';
import { keepProgressVisible } from '../../lib/progress';
import { formatReferencePitch } from '../../lib/pitch';
import { fetchSongs, type Song } from '../../lib/songs';
import { fetchSingers, fetchSingerSongPitches, type Singer, type SingerSongPitch } from '../../lib/singers';

export default function SingerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items: liveItems, isLoading: isLiveLoading, addSong, removeSong } = useLiveSession();
  const [singer, setSinger] = useState<Singer | null>(null);
  const [songs, setSongs] = useState<SingerSongPitch[]>([]);
  const [songsById, setSongsById] = useState<Record<string, Song>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingLiveKey, setPendingLiveKey] = useState<string | null>(null);
  const liveSongKeys = useMemo(() => new Set(liveItems.map((item) => `${item.songId}|${item.singerId || ''}`)), [liveItems]);

  async function toggleLive(item: SingerSongPitch, itemKey: string, isInLiveSession: boolean) {
    setPendingLiveKey(itemKey);
    try {
      await keepProgressVisible(isInLiveSession
        ? removeSong(item.songId, item.singerId)
        : addSong({ id: item.songId, name: item.songName || 'Untitled bhajan' }, { singerId: item.singerId, singerName: singer?.name || item.singerName, singerGender: singer?.gender || item.singerGender, pitch: item.pitch }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update Live queue.');
    } finally {
      setPendingLiveKey(null);
    }
  }

  useEffect(() => {
    let isActive = true;
    void fetchSongs()
      .then((all) => {
        if (isActive) setSongsById(Object.fromEntries(all.map((song) => [song.id, song])));
      })
      .catch(() => undefined);
    void Promise.all([fetchSingers(), fetchSingerSongPitches()])
      .then(([singers, associations]) => {
        if (!isActive) return;
        const foundSinger = singers.find((item) => item.id === id);
        if (!foundSinger) {
          setError('This singer is unavailable in your center.');
          return;
        }
        setSinger(foundSinger);
        setSongs(associations.filter((item) => item.singerId === id));
      })
      .catch((cause: unknown) => {
        if (isActive) {
          setError(cause instanceof Error ? cause.message : 'Unable to load this singer.');
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [id]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to singers" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.ink} size={20} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.topBarLabel}>SINGER SONGS</Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.profileHeader}>
        {isLoading ? (
          <ActivityIndicator color={colors.white} />
        ) : singer ? (
          <>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{singer.name.trim().charAt(0).toLocaleUpperCase()}</Text>
            </View>
            <Text style={[styles.singerName, { color: singerNameColor(singer.gender) }]}>{singer.name}</Text>
            <Text style={styles.singerMeta}>
              {songs.length} {songs.length === 1 ? 'song' : 'songs'}{singer.gender ? `  ·  ${singer.gender}` : ''}
            </Text>
          </>
        ) : null}
      </View>
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id || `${item.songId}-${item.singerId}`}
        renderItem={({ item, index }) => {
          const itemKey = item.id || `${item.songId}|${item.singerId || ''}`;
          const isInLiveSession = liveSongKeys.has(`${item.songId}|${item.singerId || ''}`);
          const isLivePending = pendingLiveKey === itemKey;
          return (
            <View style={styles.songRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.songName || 'song'}, pitch ${item.pitch}`}
                onPress={() => router.push({ pathname: '/song/[id]', params: { id: item.songId } })}
                style={({ pressed }) => [styles.songMain, pressed && styles.pressed]}
              >
                <View style={styles.songCopy}>
                  <Text numberOfLines={2} style={styles.songName}>{item.songName || 'Untitled bhajan'}</Text>
                  <Text style={styles.songMeta}>
                    <Text style={styles.gentsLabel}>Gents: </Text>
                    {formatReferencePitch(songsById[item.songId]?.refGents) || 'missing'}
                    {'  •  '}
                    <Text style={styles.ladiesLabel}>Ladies: </Text>
                    {formatReferencePitch(songsById[item.songId]?.refLadies) || 'missing'}
                    {'\n'}
                    <Text style={{ color: singerNameColor(singer?.gender || item.singerGender) }}>{singer?.name || item.singerName || 'Singer'}: </Text>
                    {item.pitch}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isInLiveSession ? `Remove ${item.songName || 'song'} from Live` : `Add ${item.songName || 'song'} to Live`}
                accessibilityState={{ selected: isInLiveSession, disabled: pendingLiveKey !== null || isLiveLoading }}
                disabled={pendingLiveKey !== null || isLiveLoading}
                onPress={() => void toggleLive(item, itemKey, isInLiveSession)}
                style={[styles.liveButton, isInLiveSession && styles.liveButtonSelected]}
              >
                {isLivePending
                  ? <ActivityIndicator color={isInLiveSession ? colors.white : colors.forest} size="small" />
                  : isInLiveSession ? <Check color={colors.white} size={17} /> : <ArrowRight color={colors.forest} size={18} />}
                <Text style={[styles.actionHint, isInLiveSession && styles.selectedActionHint]}>Live</Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {!isLoading ? (
              <>
              <Music2 color={colors.saffron} size={22} />
              <Text style={styles.emptyTitle}>{error || 'No song associations yet'}</Text>
              {error?.toLowerCase().includes('sign in') ? (
                <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/singers')} style={styles.returnButton}>
                  <Text style={styles.returnLabel}>Sign in to view singers</Text>
                </Pressable>
              ) : null}
              </>
            ) : null}
          </View>
        }
        style={styles.songList}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  songList: { flex: 1 },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarLabel: { color: colors.forest, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  listContent: { flexGrow: 1, paddingBottom: 30 },
  profileHeader: { backgroundColor: colors.forest, alignItems: 'center', paddingTop: 16, paddingBottom: 27, paddingHorizontal: 24 },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.saffronLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarInitial: { color: colors.forest, fontFamily: 'Georgia', fontSize: 28 },
  singerName: { color: colors.white, fontFamily: 'Georgia', fontSize: 27, lineHeight: 33, textAlign: 'center', marginTop: 7 },
  singerMeta: { color: '#C3D2C8', fontSize: 12, marginTop: 6 },
  songRow: { minHeight: 78, marginHorizontal: 16, paddingRight: 4, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, overflow: 'hidden' },
  songMain: { flex: 1, minHeight: 76, paddingLeft: 12, paddingRight: 8, flexDirection: 'row', alignItems: 'center' },
  liveButton: { width: 48, height: 72, alignItems: 'center', justifyContent: 'center', gap: 2 },
  liveButtonSelected: { backgroundColor: colors.forest },
  actionHint: { color: colors.forest, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
  selectedActionHint: { color: colors.white },
  pressed: { opacity: 0.72 },
  songCopy: { flex: 1 },
  songName: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  gentsLabel: { color: '#2563EB' },
  ladiesLabel: { color: '#DB2777' },
  songMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  separator: { height: 6 },
  emptyState: { alignItems: 'center', padding: 30 },
  emptyTitle: { color: colors.ink, fontSize: 14, textAlign: 'center', marginTop: 12 },
  returnButton: { padding: 12, marginTop: 6 },
  returnLabel: { color: colors.forest, fontWeight: '600', fontSize: 13 },
});