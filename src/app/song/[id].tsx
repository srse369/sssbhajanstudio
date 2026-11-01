import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Check, Heart, Headphones, Pause, Pencil, Play, Share2 } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFavoriteSongs, useSongs } from '../../contexts/SongsContext';
import { SongEditorModal } from '../../components/SongEditorModal';
import { keepProgressVisible } from '../../lib/progress';
import { fetchSong, updateSong, type Song, type SongInput } from '../../lib/songs';
import { formatReferencePitch } from '../../lib/pitch';
import { shareSong } from '../../lib/shareSong';
import { colors } from '../../lib/theme';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { savedSongIds, toggleSavedSong } = useFavoriteSongs();
  const { user } = useAuth();
  const { refreshSongs } = useSongs();
  const canEdit = user?.role === 'editor' || user?.role === 'admin';
  const [isEditing, setIsEditing] = useState(false);
  const [song, setSong] = useState<Song | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isFavoritePending, setIsFavoritePending] = useState(false);
  const { items: liveItems, isLoading: isLiveLoading, addSong, removeSong } = useLiveSession();
  const [isLivePending, setIsLivePending] = useState(false);
  const isInLive = liveItems.some((item) => item.songId === id);
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const playback = useAudioPlayerStatus(player);
  const [audioError, setAudioError] = useState<string | null>(null);
  const isSaved = song ? savedSongIds.includes(song.id) : false;

  async function toggleFavorite() {
    if (!song) return;
    setIsFavoritePending(true);
    try {
      await toggleSavedSong(song.id);
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : 'Unable to update favorite.');
    } finally {
      setIsFavoritePending(false);
    }
  }

  async function saveSong(input: SongInput) {
    if (!song) return;
    await updateSong(song.id, input);
    setIsEditing(false);
    setSong(await fetchSong(song.id));
    void refreshSongs();
  }

  async function toggleLive() {
    if (!song) return;
    setIsLivePending(true);
    try {
      await keepProgressVisible(isInLive ? removeSong(song.id) : addSong(song));
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : 'Unable to update Live queue.');
    } finally {
      setIsLivePending(false);
    }
  }

  useEffect(() => {
    let isActive = true;
    void fetchSong(id)
      .then((loadedSong) => {
        if (isActive) setSong(loadedSong);
      })
      .catch((cause: unknown) => {
        if (isActive) setDetailError(cause instanceof Error ? cause.message : 'Unable to open this song.');
      });
    return () => {
      isActive = false;
    };
  }, [id]);

  useEffect(() => {
    player.replace(song?.audioLink?.trim() || null);
    return () => {
      player.pause();
      player.clearLockScreenControls();
    };
  }, [player, song?.audioLink]);

  async function togglePlayback() {
    if (!song?.audioLink) return;
    setAudioError(null);
    if (playback.playing) {
      player.pause();
      return;
    }
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
      player.setActiveForLockScreen(true, { title: song.name, artist: 'SSS Bhajan Studio' });
      player.play();
    } catch {
      setAudioError('Audio could not be started. Check your connection and try again.');
    }
  }

  if (song?.id !== id) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.loadingScreen}>
        {detailError ? null : <ActivityIndicator color={colors.forest} />}
        <Text style={styles.notFoundTitle}>{detailError ? 'Unable to open song' : 'Opening songbook'}</Text>
        {detailError ? <Text style={styles.loadingText}>{detailError}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backTextButton}>
          <Text style={styles.backText}>{detailError ? 'Return to the songbook' : 'Go back'}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!song) return null;

  const metadata = [song.deity, song.language, song.raga, song.tempo].filter(Boolean);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color={colors.ink} size={21} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.topActions}>
          {canEdit ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Edit song" onPress={() => setIsEditing(true)} style={styles.iconButton}>
              <Pencil color={colors.ink} size={18} strokeWidth={1.8} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share song"
            onPress={() => void shareSong(song)}
            style={styles.iconButton}
          >
            <Share2 color={colors.ink} size={19} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from favorites' : 'Favorite song'}
            accessibilityState={{ disabled: isFavoritePending }}
            disabled={isFavoritePending}
            onPress={() => void toggleFavorite()}
            style={styles.iconButton}
          >
            {isFavoritePending
              ? <ActivityIndicator color={colors.rose} size="small" />
              : <Heart color={isSaved ? colors.rose : colors.ink} fill={isSaved ? colors.rose : 'transparent'} size={20} strokeWidth={1.8} />}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isInLive ? 'Remove from Live' : 'Add to Live'}
            accessibilityState={{ selected: isInLive, disabled: isLivePending || isLiveLoading }}
            disabled={isLivePending || isLiveLoading}
            onPress={() => void toggleLive()}
            style={[styles.liveButton, isInLive && styles.liveButtonSelected]}
          >
            {isLivePending
              ? <ActivityIndicator color={isInLive ? colors.white : colors.forest} size="small" />
              : isInLive ? <Check color={colors.white} size={17} strokeWidth={2.2} /> : <ArrowRight color={colors.forest} size={18} strokeWidth={1.9} />}
            <Text style={[styles.liveLabel, isInLive && styles.liveLabelSelected]}>Live</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        <View style={styles.songIntro}>
          {song.language ? <Text style={styles.songEyebrow}>{song.language.toLocaleUpperCase()}</Text> : null}
          <Text style={styles.songTitle}>{song.name}</Text>
          {song.deity ? <Text style={styles.deityName}>A song for {song.deity}</Text> : null}
          {metadata.length > 0 ? (
            <View style={styles.metadataRow}>
              {metadata.map((value, index) => (
                <Text key={`${value}-${index}`} style={styles.metadataText}>{value}</Text>
              ))}
            </View>
          ) : null}
          {song.refGents || song.refLadies ? (
            <Text style={styles.pitchLine}>
              {song.refGents ? (
                <>
                  <Text style={styles.gentsLabel}>Gents: </Text>
                  {formatReferencePitch(song.refGents)}
                </>
              ) : null}
              {song.refGents && song.refLadies ? ' • ' : null}
              {song.refLadies ? (
                <>
                  <Text style={styles.ladiesLabel}>Ladies: </Text>
                  {formatReferencePitch(song.refLadies)}
                </>
              ) : null}
            </Text>
          ) : null}
        </View>

        {song.audioLink ? (
          <View style={styles.playerCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playback.playing ? 'Pause bhajan' : 'Play bhajan'}
              onPress={() => void togglePlayback()}
              style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
            >
              {playback.isBuffering ? (
                <ActivityIndicator color={colors.white} />
              ) : playback.playing ? (
                <Pause color={colors.white} fill={colors.white} size={20} />
              ) : (
                <Play color={colors.white} fill={colors.white} size={20} />
              )}
            </Pressable>
            <View style={styles.playerInfo}>
              <Text style={styles.playerTitle}>{playback.playing ? 'Now playing' : 'Listen to this bhajan'}</Text>
              <View style={styles.trackMeta}>
                <Headphones color={colors.muted} size={13} />
                <Text style={styles.trackTime}>{formatTime(playback.currentTime)} / {formatTime(playback.duration)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${playback.duration ? Math.min(100, (playback.currentTime / playback.duration) * 100) : 0}%` }]} />
              </View>
              {audioError || playback.error ? <Text style={styles.audioError}>{audioError || playback.error}</Text> : null}
            </View>
          </View>
        ) : null}

        <View style={styles.lyricsHeader}>
          <Text style={styles.lyricsLabel}>LYRICS</Text>
          <View style={styles.lyricsRule} />
        </View>
        {song.lyrics?.trim() ? (
          <Text style={styles.lyricsText}>{song.lyrics.trim()}</Text>
        ) : (
          <Text style={styles.noLyrics}>Lyrics have not been added for this song yet.</Text>
        )}
        {song.meaning?.trim() ? (
          <View style={styles.meaningBlock}>
            <Text style={styles.lyricsLabel}>MEANING</Text>
            <Text style={styles.meaningText}>{song.meaning.trim()}</Text>
          </View>
        ) : null}
      </ScrollView>
      {canEdit && isEditing ? (
        <SongEditorModal visible song={song} onClose={() => setIsEditing(false)} onSubmit={saveSong} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  detailScroll: { flex: 1 },
  loadingScreen: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 13 },
  notFoundTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 23 },
  backTextButton: { marginTop: 16, padding: 10 },
  backText: { color: colors.forest, fontSize: 14, fontWeight: '600' },
  topBar: { height: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  liveButton: { minWidth: 46, height: 40, marginLeft: 2, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  liveButtonSelected: { backgroundColor: colors.forest },
  liveLabel: { color: colors.forest, fontSize: 9, fontWeight: '700' },
  liveLabelSelected: { color: colors.white },
  topActions: { flexDirection: 'row', alignItems: 'center' },
  detailContent: { paddingHorizontal: 24, paddingBottom: 42 },
  songIntro: { alignItems: 'center', paddingTop: 16, paddingBottom: 27 },
  songEyebrow: { color: colors.saffron, fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  songTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 29, lineHeight: 36, textAlign: 'center', marginTop: 8 },
  deityName: { color: colors.muted, fontSize: 13, marginTop: 6 },
  metadataRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  pitchLine: { color: colors.ink, fontSize: 12, textAlign: 'center', marginTop: 12 },
  gentsLabel: { color: '#2563EB' },
  ladiesLabel: { color: '#DB2777' },
  metadataText: { color: colors.forest, backgroundColor: colors.sage, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6, fontSize: 11, overflow: 'hidden' },
  playerCard: { minHeight: 88, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  playButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  playButtonPressed: { opacity: 0.75 },
  playerInfo: { flex: 1 },
  playerTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  trackMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 5 },
  trackTime: { color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 3, backgroundColor: colors.line, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.saffron },
  audioError: { color: colors.error, fontSize: 11, marginTop: 6 },
  lyricsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 19 },
  lyricsLabel: { color: colors.saffron, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
  lyricsRule: { flex: 1, height: 1, backgroundColor: colors.line },
  lyricsText: { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, fontFamily: 'Georgia', fontSize: 19, lineHeight: 34, textAlign: 'center', paddingHorizontal: 19, paddingVertical: 22 },
  noLyrics: { color: colors.muted, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, fontSize: 14, textAlign: 'center', paddingHorizontal: 20, paddingVertical: 28 },
  meaningBlock: { marginTop: 34, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line },
  meaningText: { color: colors.muted, fontSize: 15, lineHeight: 24, marginTop: 12 },
});