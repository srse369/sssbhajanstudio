import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Check, Heart, Pencil, Search, Share2, Trash2, WifiOff } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { useSongs } from '../contexts/SongsContext';
import { useLiveSession } from '../contexts/LiveSessionContext';
import { AlphabetIndex, alphabetIndexStyles, useAlphabetJump } from './AlphabetIndex';
import { AddFab } from './AddFab';
import { formatCount } from '../lib/count';
import { formatReferencePitch } from '../lib/pitch';
import { shareSong } from '../lib/shareSong';
import { colors } from '../lib/theme';
import { keepProgressVisible } from '../lib/progress';
import { createSong, deleteSong, fetchSong, updateSong, type Song, type SongInput } from '../lib/songs';
import { SongEditorModal } from './SongEditorModal';

interface SongLibraryProps {
  savedOnly?: boolean;
}

const EMPTY_SONG_IDS = new Set<string>();

function normalizeLanguage(language: string) {
  return language.trim().toLocaleLowerCase();
}

function parseLanguages(language: string | null | undefined) {
  return language
    ? language.split(/[,/]/).map(normalizeLanguage).filter(Boolean)
    : [];
}

function getSongName(song: Song) {
  return song.name;
}

function formatLabel(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

const ROW_HEIGHT = 64;
const ROW_SEPARATOR = 1;
const ROW_STRIDE = ROW_HEIGHT + ROW_SEPARATOR;

interface SongRowProps {
  item: Song;
  index: number;
  isInLiveSession: boolean;
  canManageSongs: boolean;
  canDeleteSong: boolean;
  isDeleting: boolean;
  addSong: (
    song: Pick<Song, 'id' | 'name' | 'language' | 'deity'>,
    details?: { singerId?: string; singerName?: string; pitch?: string },
  ) => Promise<void>;
  removeSong: (songId: string) => Promise<void>;
  isLiveLoading: boolean;
  onEditSong: (song: Song) => void;
  onDeleteSong: (song: Song) => void;
}

const SongRow = memo(function SongRow({
  item,
  index,
  isInLiveSession,
  canManageSongs,
  canDeleteSong,
  isDeleting,
  addSong,
  removeSong,
  isLiveLoading,
  onEditSong,
  onDeleteSong,
}: SongRowProps) {
  const [isLivePending, setIsLivePending] = useState(false);
  const subtitle = [item.deity, item.language, item.raga, item.tempo]
    .filter(Boolean)
    .map((value) => formatLabel(value as string))
    .join(' · ');

  async function toggleLive() {
    setIsLivePending(true);
    try {
      await keepProgressVisible(isInLiveSession ? removeSong(item.id) : addSong(item));
    } catch (cause) {
      Alert.alert('Unable to update Live queue', cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setIsLivePending(false);
    }
  }

  return (
    <View style={styles.songRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name}`}
        onPress={() => router.push({ pathname: '/song/[id]', params: { id: item.id } })}
        style={({ pressed }) => [styles.songMain, pressed && styles.pressed]}
      >
        <View style={styles.songCopy}>
          <Text numberOfLines={1} style={styles.songTitle}>{item.name}</Text>
          <Text numberOfLines={1} style={styles.songSubtitle}>{subtitle || 'Sai bhajan'}</Text>
          {item.refGents || item.refLadies ? (
            <Text numberOfLines={1} style={styles.pitchLine}>
              {item.refGents ? (
                <>
                  <Text style={styles.gentsLabel}>Gents: </Text>
                  {formatReferencePitch(item.refGents)}
                </>
              ) : null}
              {item.refGents && item.refLadies ? ' • ' : null}
              {item.refLadies ? (
                <>
                  <Text style={styles.ladiesLabel}>Ladies: </Text>
                  {formatReferencePitch(item.refLadies)}
                </>
              ) : null}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Share ${item.name}`}
        onPress={() => void shareSong(item)}
        hitSlop={10}
        style={styles.saveButton}
      >
        <Share2 color={colors.forest} size={18} strokeWidth={1.8} />
        <Text style={styles.actionHint}>Share</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isInLiveSession ? `Remove ${item.name} from Live` : `Add ${item.name} to Live`}
        accessibilityState={{ selected: isInLiveSession, disabled: isLivePending || isLiveLoading }}
        disabled={isLivePending || isLiveLoading}
        onPress={() => void toggleLive()}
        hitSlop={8}
        style={[styles.liveButton, isInLiveSession && styles.liveButtonSelected]}
      >
        {isLivePending
          ? <ActivityIndicator color={isInLiveSession ? colors.white : colors.forest} size="small" />
          : isInLiveSession
          ? <Check color={colors.white} size={18} strokeWidth={2.2} />
          : <ArrowRight color={colors.forest} size={19} strokeWidth={1.9} />}
        <Text style={[styles.actionHint, isInLiveSession && styles.selectedActionHint]}>Live</Text>
      </Pressable>
      {canManageSongs ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
          onPress={() => onEditSong(item)}
          hitSlop={8}
          style={styles.manageButton}
        >
          <Pencil color={colors.forest} size={16} />
          <Text style={styles.actionHint}>Edit</Text>
        </Pressable>
      ) : null}
      {canDeleteSong ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.name}`}
          accessibilityState={{ disabled: isDeleting }}
          disabled={isDeleting}
          onPress={() => onDeleteSong(item)}
          hitSlop={8}
          style={styles.manageButton}
        >
          {isDeleting ? <ActivityIndicator color={colors.rose} size="small" /> : <Trash2 color={colors.rose} size={17} />}
          <Text style={styles.deleteHint}>Delete</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

export function SongLibrary({ savedOnly = false }: SongLibraryProps) {
  const { user } = useAuth();
  const { songs, savedSongIds, isLoading, error, refreshSongs } = useSongs();
  const { items: liveItems, isLoading: isLiveLoading, addSong, removeSong } = useLiveSession();
  const favoriteSongIds = useMemo(() => new Set(savedSongIds), [savedSongIds]);
  const liveSongIds = useMemo(() => new Set(liveItems.map((item) => item.songId)), [liveItems]);
  const [query, setQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const deferredLanguage = useDeferredValue(selectedLanguage);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const canManageSongs = user?.role === 'editor' || user?.role === 'admin';
  const favoriteIdsForFilter = savedOnly ? favoriteSongIds : EMPTY_SONG_IDS;
  const savedSongs = useMemo(
    () => savedOnly ? songs.filter((song) => favoriteIdsForFilter.has(song.id)) : songs,
    [songs, savedOnly, favoriteIdsForFilter],
  );
  const searchableSongs = useMemo(() => savedSongs.map((song) => ({
    song,
    languages: parseLanguages(song.language),
    searchText: [song.name, song.language, song.deity, song.lyrics, song.meaning]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase(),
  })), [savedSongs]);
  const languages = useMemo(() => [
    'all',
    ...new Set(searchableSongs.flatMap(({ languages: songLanguages }) => songLanguages)),
  ], [searchableSongs]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const isFilteringLanguages = selectedLanguage !== deferredLanguage;
  const visibleSongs = useMemo(() => searchableSongs.filter(({ languages: songLanguages, searchText }) => {
    const matchesLanguage = deferredLanguage === 'all' || songLanguages.includes(deferredLanguage);
    if (!matchesLanguage) return false;
    return searchText.includes(normalizedQuery);
  }).map(({ song }) => song).sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })),
  [searchableSongs, deferredLanguage, normalizedQuery]);
  const {
    listRef, windowedItems: windowedSongs, availableLetters, scrollToLetter, loadEarlier, loadLater, showIndex,
  } = useAlphabetJump(visibleSongs, getSongName);

  const openSongEditor = useCallback(async (song: Song | null) => {
    if (!song) {
      setEditingSong(null);
      setIsEditorVisible(true);
      return;
    }
    // The list endpoint omits lyrics, meaning and video link, so load the full record first.
    try {
      setEditingSong(await fetchSong(song.id));
      setIsEditorVisible(true);
    } catch (cause) {
      Alert.alert('Unable to open song', cause instanceof Error ? cause.message : 'Please try again.');
    }
  }, []);

  async function saveSong(input: SongInput) {
    if (editingSong) await updateSong(editingSong.id, input);
    else await createSong(input);
    setIsEditorVisible(false);
    await refreshSongs();
  }

  const confirmDeleteSong = useCallback((song: Song) => {
    Alert.alert('Delete bhajan?', `Delete ${song.name}? Songs used in pitches or presentations cannot be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeletingSongId(song.id);
          void deleteSong(song.id)
            .then(() => refreshSongs())
            .catch((cause: unknown) => Alert.alert('Unable to delete bhajan', cause instanceof Error ? cause.message : 'Please try again.'))
            .finally(() => setDeletingSongId(null));
        },
      },
    ]);
  }, [refreshSongs]);

  const renderSong = useCallback(({ item, index }: { item: Song; index: number }) => (
    <SongRow
      item={item}
      index={index}
      isInLiveSession={liveSongIds.has(item.id)}
      canManageSongs={canManageSongs}
      canDeleteSong={user?.role === 'admin' || (user?.role === 'editor' && item.createdBy === user.email)}
      isDeleting={deletingSongId === item.id}
      addSong={addSong}
      removeSong={removeSong}
      isLiveLoading={isLiveLoading}
      onEditSong={openSongEditor}
      onDeleteSong={confirmDeleteSong}
    />
  ), [liveSongIds, isLiveLoading, canManageSongs, user, deletingSongId, addSong, removeSong, openSongEditor, confirmDeleteSong]);

  function renderEmptyState() {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.forest} size="small" />
          <Text style={styles.emptyTitle}>Finding your bhajans</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <WifiOff color={colors.rose} size={24} strokeWidth={1.7} />
          <Text style={styles.emptyTitle}>The library is unavailable</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refreshSongs()} style={styles.retryButton}>
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    if (savedOnly && savedSongs.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Heart color={colors.saffron} size={25} strokeWidth={1.7} />
          <Text style={styles.emptyTitle}>Your favorite bhajans will live here</Text>
          <Text style={styles.emptyBody}>Tap the heart beside a bhajan to add it to your favorites.</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Search color={colors.muted} size={24} strokeWidth={1.7} />
        <Text style={styles.emptyTitle}>No bhajans found</Text>
        <Text style={styles.emptyBody}>Try another title, language, or deity.</Text>
      </View>
    );
  }

  return (
    <View style={styles.library}>
      {canManageSongs && !savedOnly ? <AddFab label="Add bhajan" onPress={() => openSongEditor(null)} /> : null}
      <View>
        <View style={styles.masthead}>
          <Text style={styles.heading}>{savedOnly ? 'Favorite Bhajans' : 'Songs'}</Text>
          <Text style={styles.intro}>
            {savedOnly
              ? `${formatCount(visibleSongs.length, savedSongs.length)} favorite ${savedSongs.length === 1 ? 'bhajan' : 'bhajans'}.`
              : `${songs.length ? `${formatCount(visibleSongs.length, songs.length)} songs` : 'Songs and lyrics'} for your daily practice.`}
          </Text>
      </View>
        <View style={styles.searchWrap}>
          <Search color={colors.muted} size={19} strokeWidth={1.8} />
          <TextInput
            accessibilityLabel="Search bhajans"
            placeholder="Search title, lyric, deity..."
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {languages.map((language) => {
            const selected = selectedLanguage === language;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={language}
                onPress={() => setSelectedLanguage(language)}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
              >
                <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>
                  {language === 'all' ? 'All' : formatLabel(language)}
                </Text>
                {selected && isFilteringLanguages ? <ActivityIndicator color={colors.forest} size="small" /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.listArea}>
        <FlatList
          ref={listRef}
          style={styles.songList}
          data={windowedSongs}
          onStartReached={loadEarlier}
          onEndReached={loadLater}
          onEndReachedThreshold={2}
          onStartReachedThreshold={0.5}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          keyExtractor={(song) => song.id}
          renderItem={renderSong}
          getItemLayout={(_, position) => ({ length: ROW_STRIDE, offset: ROW_STRIDE * position, index: position })}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={3}
          updateCellsBatchingPeriod={30}
          removeClippedSubviews
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[styles.listContent, showIndex && alphabetIndexStyles.listContentWithIndex]}
          ItemSeparatorComponent={() => <View style={styles.rowGap} />}
          refreshControl={
            <RefreshControl refreshing={isLoading && songs.length > 0} onRefresh={() => void refreshSongs()} tintColor={colors.forest} />
          }
          showsVerticalScrollIndicator={false}
        />
        {showIndex ? <AlphabetIndex available={availableLetters} onSelect={scrollToLetter} /> : null}
      </View>
      {canManageSongs && isEditorVisible ? (
        <SongEditorModal
          visible
          song={editingSong}
          onClose={() => setIsEditorVisible(false)}
          onSubmit={saveSong}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  library: { flex: 1, backgroundColor: colors.paper },
  listArea: { flex: 1 },
  songList: { flex: 1 },
  listContent: { backgroundColor: colors.paper, paddingHorizontal: 16, paddingBottom: 18 },
  masthead: { backgroundColor: colors.forest, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 23 },
  heading: { color: '#E6C08B', fontSize: 25, lineHeight: 30, fontWeight: '700', textAlign: 'center', marginTop: -8 },
  intro: { color: '#C3D2C8', fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: 'center' },
  searchWrap: { minHeight: 44, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 7, marginHorizontal: 16, marginTop: -10, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, minHeight: 42, color: colors.ink, fontSize: 13, marginLeft: 8, paddingVertical: 0 },
  filterRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 6 },
  filterChip: { minHeight: 27, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: colors.surface },
  filterChipSelected: { backgroundColor: colors.saffronLight, borderColor: colors.saffronLight },
  filterLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  filterLabelSelected: { color: colors.forestDeep },
  songRow: { flexDirection: 'row', alignItems: 'center', height: 64 },
  songMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 62, paddingLeft: 2, paddingRight: 6 },
  pressed: { opacity: 0.72 },
  songCopy: { flex: 1, marginRight: 6 },
  songTitle: { color: colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  pitchLine: { color: colors.ink, fontSize: 10, lineHeight: 13, marginTop: 1 },
  gentsLabel: { color: '#2563EB' },
  ladiesLabel: { color: '#DB2777' },
  songSubtitle: { color: colors.muted, fontSize: 10, lineHeight: 13 },
  saveButton: { width: 40, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  liveButton: { width: 40, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  liveButtonSelected: { backgroundColor: colors.forest },
  manageButton: { width: 40, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionHint: { color: colors.muted, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
  selectedActionHint: { color: colors.white },
  deleteHint: { color: colors.rose, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
  rowGap: { height: 1, backgroundColor: colors.line },
  emptyState: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 40, paddingBottom: 56 },
  emptyTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 18, textAlign: 'center', marginTop: 14 },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 270 },
  retryButton: { backgroundColor: colors.forest, borderRadius: 6, paddingHorizontal: 18, paddingVertical: 10, marginTop: 17 },
  retryLabel: { color: colors.white, fontSize: 13, fontWeight: '600' },
});