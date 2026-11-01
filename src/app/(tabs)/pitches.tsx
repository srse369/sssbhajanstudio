import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Alert, ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowRight, AudioLines, Check, Pencil, Search, Trash2 } from 'lucide-react-native';
import { AlphabetIndex, alphabetIndexStyles, compareNames, useAlphabetJump } from '../../components/AlphabetIndex';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { useSongCatalog } from '../../contexts/SongsContext';
import { colors } from '../../lib/theme';
import { keepProgressVisible } from '../../lib/progress';
import { formatReferencePitch } from '../../lib/pitch';
import { singerNameColor } from '../../lib/singerColors';
import {
  createSingerSongPitch,
  deleteSingerSongPitch,
  fetchSingers,
  fetchSingerSongPitches,
  type SingerSongPitch,
  type Singer,
  updateSingerSongPitch,
} from '../../lib/singers';
import { AddFab } from '../../components/AddFab';
import { formatCount } from '../../lib/count';
import { PitchEditorModal } from '../../components/PitchEditorModal';

const EMPTY_CENTER_IDS: number[] = [];

interface PitchRowProps {
  item: SingerSongPitch;
  index: number;
  singerGender?: string;
  refGents?: string | null;
  refLadies?: string | null;
  isInLiveSession: boolean;
  isLiveLoading: boolean;
  showManagementActions: boolean;
  isMutating: boolean;
  addSong: (song: { id: string; name: string }, details: { singerId: string; singerName?: string; singerGender?: string; pitch: string }) => Promise<void>;
  removeSong: (songId: string, singerId?: string) => Promise<void>;
  onEdit: (item: SingerSongPitch) => void;
  onDelete: (item: SingerSongPitch) => void;
}

function SegmentedToggle<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.segment}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segmentOption, selected && styles.segmentOptionSelected]}
          >
            <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const PitchRow = memo(function PitchRow({
  item,
  index,
  singerGender,
  refGents,
  refLadies,
  isInLiveSession,
  isLiveLoading,
  showManagementActions,
  isMutating,
  addSong,
  removeSong,
  onEdit,
  onDelete,
}: PitchRowProps) {
  const [isLivePending, setIsLivePending] = useState(false);

  async function toggleLive() {
    setIsLivePending(true);
    try {
      await keepProgressVisible(isInLiveSession
        ? removeSong(item.songId, item.singerId)
        : addSong({ id: item.songId, name: item.songName || 'Untitled bhajan' }, { singerId: item.singerId, singerName: item.singerName, singerGender, pitch: item.pitch }));
    } catch (cause) {
      Alert.alert('Unable to update Live queue', cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setIsLivePending(false);
    }
  }

  return (
    <View style={styles.pitchRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.songName || 'song'}, sung by ${item.singerName || 'singer'}, pitch ${item.pitch}`}
        onPress={() => router.push({ pathname: '/song/[id]', params: { id: item.songId } })}
        style={({ pressed }) => [styles.pitchMain, pressed && styles.rowPressed]}
      >
        <View style={styles.pitchCopy}>
          <Text numberOfLines={1} style={styles.songName}>{item.songName || 'Untitled bhajan'}</Text>
          <Text numberOfLines={1} style={styles.singerName}>
            <Text style={styles.gentsLabel}>Gents: </Text>
            {formatReferencePitch(refGents) || 'missing'}
            {'  •  '}
            <Text style={styles.ladiesLabel}>Ladies: </Text>
            {formatReferencePitch(refLadies) || 'missing'}
          </Text>
          <Text numberOfLines={1} style={styles.singerName}>
            <Text style={{ color: singerNameColor(singerGender) }}>{item.singerName || 'Singer'}: </Text>
            {item.pitch}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isInLiveSession ? `Remove ${item.songName || 'song'} for ${item.singerName || 'singer'} from Live` : `Add ${item.songName || 'song'} for ${item.singerName || 'singer'} to Live`}
        accessibilityState={{ selected: isInLiveSession, disabled: isLivePending || isLiveLoading }}
        disabled={isLivePending || isLiveLoading}
        onPress={() => void toggleLive()}
        style={[styles.liveButton, isInLiveSession && styles.liveButtonSelected]}
      >
        {isLivePending
          ? <ActivityIndicator color={isInLiveSession ? colors.white : colors.forest} size="small" />
          : isInLiveSession ? <Check color={colors.white} size={17} /> : <ArrowRight color={colors.forest} size={18} />}
        <Text style={[styles.actionHint, isInLiveSession && styles.selectedActionHint]}>Live</Text>
      </Pressable>
      {showManagementActions ? (
        <View style={styles.pitchManagementActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit pitch for ${item.songName || 'song'}`}
            disabled={!item.id || isMutating}
            onPress={() => onEdit(item)}
            style={[styles.managementButton, (!item.id || isMutating) && styles.disabledAction]}
          >
            <Pencil color={colors.forest} size={16} />
            <Text style={styles.actionHint}>Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete pitch for ${item.songName || 'song'}`}
            disabled={!item.id || isMutating}
            onPress={() => onDelete(item)}
            style={[styles.managementButton, (!item.id || isMutating) && styles.disabledAction]}
          >
            {isMutating ? <ActivityIndicator color={colors.rose} size="small" /> : <Trash2 color={colors.rose} size={17} />}
            <Text style={styles.deleteHint}>Delete</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

export default function PitchesScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { items: liveItems, isLoading: isLiveLoading, addSong, removeSong } = useLiveSession();
  const { songs } = useSongCatalog();
  const [pitches, setPitches] = useState<SingerSongPitch[]>([]);
  const [singers, setSingers] = useState<Singer[]>([]);
  const [query, setQuery] = useState('');
  const [pitchScope, setPitchScope] = useState<'mine' | 'all'>('mine');
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPitchFormVisible, setIsPitchFormVisible] = useState(false);
  const [editingPitch, setEditingPitch] = useState<SingerSongPitch | null>(null);
  const [mutatingPitchId, setMutatingPitchId] = useState<string | null>(null);

  function openAddPitch() {
    setEditingPitch(null);
    setIsPitchFormVisible(true);
  }

  const openEditPitch = useCallback((item: SingerSongPitch) => {
    setEditingPitch(item);
    setIsPitchFormVisible(true);
  }, []);

  async function savePitch(input: { songId: string; singerId: string; pitch: string }, existingPitchId?: string) {
    const pitchId = existingPitchId || editingPitch?.id;
    if (pitchId) {
      await updateSingerSongPitch(pitchId, input.pitch);
    } else {
      await createSingerSongPitch(input);
    }
    setIsPitchFormVisible(false);
    await loadPitches();
  }

  const confirmDeletePitch = useCallback((item: SingerSongPitch) => {
    if (!item.id) return;
    Alert.alert(
      'Delete pitch?',
      `${item.songName || 'This song'} for ${item.singerName || 'this singer'} will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMutatingPitchId(item.id || null);
            void deleteSingerSongPitch(item.id as string)
              .then(() => {
                setPitches((current) => current.filter((pitch) => pitch.id !== item.id));
                setError(null);
              })
              .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to delete pitch.'))
              .finally(() => setMutatingPitchId(null));
          },
        },
      ],
    );
  }, []);

  async function loadPitches() {
    setIsRefreshing(true);
    setError(null);
    try {
      const [loadedPitches, loadedSingers] = await Promise.all([fetchSingerSongPitches(), fetchSingers()]);
      setPitches(loadedPitches);
      setSingers(loadedSingers);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load pitches.';
      if (message.toLocaleLowerCase().includes('authentication')) {
        setError('Your session expired. Sign in again from your profile.');
      } else {
        setError(message);
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let isActive = true;
    void Promise.all([fetchSingerSongPitches(), fetchSingers()])
      .then(([loadedPitches, loadedSingers]) => {
        if (isActive) {
          setPitches(loadedPitches);
          setSingers(loadedSingers);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (isActive) setError(cause instanceof Error ? cause.message : 'Unable to load pitches.');
      })
      .finally(() => {
        if (isActive) setLoadedForUser(userId);
      });
    return () => {
      isActive = false;
    };
  }, [userId]);

  const isAdmin = user?.role === 'admin';
  const canManageAllPitches = isAdmin || user?.role === 'editor';
  const accessibleCenterIds = useMemo(
    () => user?.role === 'editor' ? user.editorFor : user?.centerIds || EMPTY_CENTER_IDS,
    [user],
  );
  const allPitchSingerIds = useMemo(() => new Set(
    isAdmin
      ? singers.map((singer) => singer.id)
      : singers.filter((singer) => singer.centerIds.some((centerId) => accessibleCenterIds.includes(centerId))).map((singer) => singer.id),
  ), [isAdmin, singers, accessibleCenterIds]);
    const singersById = useMemo(() => new Map(singers.map((singer) => [singer.id, singer])), [singers]);
  const songsById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const scopedPitches = useMemo(() => pitchScope === 'mine'
    ? pitches.filter((item) => item.singerId === user?.id)
    : isAdmin
      ? pitches
      : pitches.filter((item) => allPitchSingerIds.has(item.singerId)),
  [pitchScope, pitches, user?.id, isAdmin, allPitchSingerIds]);
  const [sortBy, setSortBy] = useState<'song' | 'singer'>('song');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visiblePitches = useMemo(() => scopedPitches.filter((item) =>
    [item.songName, item.singerName, item.pitch]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  ).sort((first, second) => sortBy === 'singer'
    ? compareNames(first.singerName || '', second.singerName || '') || compareNames(first.songName || '', second.songName || '')
    : compareNames(first.songName || '', second.songName || '') || compareNames(first.singerName || '', second.singerName || '')),
  [scopedPitches, normalizedQuery, sortBy]);
  const { listRef, windowedItems, availableLetters, scrollToLetter, loadEarlier, loadLater, showIndex } = useAlphabetJump(
    visiblePitches,
    sortBy === 'singer' ? getPitchSingerName : getPitchSongName,
  );
  const livePitchKeys = useMemo(() => new Set(liveItems.map((item) => `${item.songId}|${item.singerId || ''}`)), [liveItems]);
  const showManagementActions = pitchScope === 'mine' || canManageAllPitches;
  const renderPitch = useCallback(({ item, index }: { item: SingerSongPitch; index: number }) => (
    <PitchRow
      item={item}
      index={index}
      singerGender={singersById.get(item.singerId)?.gender}
      refGents={songsById.get(item.songId)?.refGents}
      refLadies={songsById.get(item.songId)?.refLadies}
      isInLiveSession={livePitchKeys.has(`${item.songId}|${item.singerId}`)}
      isLiveLoading={isLiveLoading}
      showManagementActions={showManagementActions}
      isMutating={mutatingPitchId === item.id}
      addSong={addSong}
      removeSong={removeSong}
      onEdit={openEditPitch}
      onDelete={confirmDeletePitch}
    />
  ), [livePitchKeys, isLiveLoading, showManagementActions, mutatingPitchId, addSong, removeSong, openEditPitch, confirmDeletePitch, singersById, songsById]);

  if (isAuthLoading || (user && loadedForUser !== user.id)) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.forest} />
          <Text style={styles.loadingLabel}>Opening pitch book</Text>
        </View>
      </View>
    );
  }

  if (!user) return <Redirect href="/(tabs)" />;

  return (
    <View style={styles.screen}>
      {pitchScope === 'mine' || canManageAllPitches ? <AddFab label="Add pitch" onPress={openAddPitch} /> : null}
      <View>
        <View style={styles.header}>
          <Text style={styles.heading}>Pitches</Text>
          <Text style={styles.intro}>
            {pitchScope === 'mine'
              ? `${formatCount(visiblePitches.length, scopedPitches.length)} assignments${user?.name ? ` for ${user.name}` : ''}.`
              : isAdmin
                ? `${formatCount(visiblePitches.length, scopedPitches.length)} assignments across all centers.`
                : `${formatCount(visiblePitches.length, scopedPitches.length)} assignments across authorized centers.`}
          </Text>
        </View>
        <View style={styles.searchWrap}>
          <Search color={colors.muted} size={18} strokeWidth={1.8} />
          <TextInput
            accessibilityLabel="Search pitches"
            onChangeText={setQuery}
            placeholder="Search song, singer, or pitch"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Text style={styles.groupLabel}>Pitches</Text>
          <SegmentedToggle
            options={[{ value: 'mine', label: 'My' }, { value: 'all', label: 'All' }]}
            value={pitchScope}
            onChange={setPitchScope}
          />
          <Text style={[styles.groupLabel, styles.groupLabelSpaced]}>Sort</Text>
          <SegmentedToggle
            options={[{ value: 'song', label: 'Song, Singer' }, { value: 'singer', label: 'Singer, Song' }]}
            value={sortBy}
            onChange={setSortBy}
          />
        </ScrollView>
      </View>
      <View style={alphabetIndexStyles.listArea}>
      <FlatList
        ref={listRef}
        style={styles.pitchList}
        data={windowedItems}
        onStartReached={loadEarlier}
        onStartReachedThreshold={0.5}
        onEndReached={loadLater}
        onEndReachedThreshold={2}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyExtractor={(item) => item.id || `${item.songId}-${item.singerId}`}
        renderItem={renderPitch}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {isRefreshing ? <ActivityIndicator color={colors.forest} /> : <AudioLines color={colors.saffron} size={23} />}
            <Text style={styles.emptyTitle}>{error || (isRefreshing ? 'Loading pitches' : 'No pitch assignments found')}</Text>
          </View>
        }
        contentContainerStyle={[styles.listContent, showIndex && alphabetIndexStyles.listContentWithIndex]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadPitches()} tintColor={colors.forest} />}
        showsVerticalScrollIndicator={false}
      />
      {showIndex ? <AlphabetIndex available={availableLetters} onSelect={scrollToLetter} /> : null}
      </View>
      {user && isPitchFormVisible ? (
        <PitchEditorModal
          visible
          pitch={editingPitch}
          scope={pitchScope}
          user={user}
          songs={songs}
          singers={pitchScope === 'all' && !isAdmin ? singers.filter((singer) => singer.centerIds.some((centerId) => accessibleCenterIds.includes(centerId))) : singers}
          existingPitches={pitches}
          onClose={() => setIsPitchFormVisible(false)}
          onSubmit={savePitch}
        />
      ) : null}
    </View>
  );
}

function getPitchSingerName(pitch: SingerSongPitch) {
  return pitch.singerName || '';
}

function getPitchSongName(pitch: SingerSongPitch) {
  return pitch.songName || '';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  pitchList: { flex: 1 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingLabel: { color: colors.muted, fontSize: 13, marginTop: 12 },
  header: { backgroundColor: colors.forest, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 23 },
  heading: { color: '#E6C08B', fontSize: 25, lineHeight: 30, fontWeight: '700', textAlign: 'center', marginTop: -8 },
  intro: { color: '#C3D2C8', fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: 'center' },
  searchWrap: { minHeight: 44, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 7, marginHorizontal: 16, marginTop: -10, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, minHeight: 42, color: colors.ink, fontSize: 13, marginLeft: 8, paddingVertical: 0 },
  filterRow: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 6 },
  filterChip: { minHeight: 27, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: colors.surface },
  filterChipSelected: { backgroundColor: colors.saffronLight, borderColor: colors.saffronLight },
  segment: { flexDirection: 'row', backgroundColor: colors.sage, borderRadius: 16, padding: 2 },
  segmentOption: { minHeight: 27, paddingHorizontal: 7, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segmentOptionSelected: { backgroundColor: colors.saffronLight },
  groupLabel: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  groupLabelSpaced: { marginLeft: 8 },
  filterLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  filterLabelSelected: { color: colors.forestDeep },
  listContent: { flexGrow: 1, backgroundColor: colors.paper, paddingHorizontal: 16, paddingBottom: 16 },
  pitchRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center' },
  pitchMain: { flex: 1, minHeight: 62, paddingLeft: 0, paddingRight: 6, flexDirection: 'row', alignItems: 'center' },
  liveButton: { width: 40, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  liveButtonSelected: { backgroundColor: colors.forest },
  pitchManagementActions: { flexDirection: 'row', alignItems: 'center' },
  managementButton: { width: 40, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionHint: { color: colors.muted, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
  selectedActionHint: { color: colors.white },
  deleteHint: { color: colors.rose, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
  disabledAction: { opacity: 0.35 },
  rowPressed: { opacity: 0.72 },
  pitchCopy: { flex: 1, marginRight: 6 },
  songName: { color: colors.ink, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  singerName: { color: colors.ink, fontSize: 10, lineHeight: 14 },
  gentsLabel: { color: '#2563EB' },
  ladiesLabel: { color: '#DB2777' },
  separator: { height: 1, backgroundColor: colors.line },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  emptyTitle: { color: colors.ink, fontSize: 14, textAlign: 'center', marginTop: 12 },
});