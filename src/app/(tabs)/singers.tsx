import { useEffect, useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Alert, ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pencil, Search, Trash2, UsersRound } from 'lucide-react-native';
import { AlphabetIndex, alphabetIndexStyles, compareNames, useAlphabetJump } from '../../components/AlphabetIndex';
import { colors } from '../../lib/theme';
import { formatCount } from '../../lib/count';
import { singerNameColor } from '../../lib/singerColors';
import { useAuth } from '../../contexts/AuthContext';
import {
  createSingerProfile,
  deleteSingerProfile,
  fetchAccountCenters,
  fetchEditableCenters,
  fetchSingers,
  fetchSingerSongPitches,
  type Singer,
  type SingerSongPitch,
  type AccountCenter,
  type SingerInput,
  updateSingerProfile,
} from '../../lib/singers';
import { AddFab } from '../../components/AddFab';
import { SingerEditorModal } from '../../components/SingerEditorModal';

export default function SingersScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [singers, setSingers] = useState<Singer[]>([]);
  const [pitches, setPitches] = useState<SingerSongPitch[]>([]);
  const [managementCenters, setManagementCenters] = useState<AccountCenter[]>([]);
  const [query, setQuery] = useState('');
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSingerFormVisible, setIsSingerFormVisible] = useState(false);
  const [editingSinger, setEditingSinger] = useState<Singer | null>(null);
  const [mutatingSingerId, setMutatingSingerId] = useState<string | null>(null);

  const canManageSingers = user?.role === 'admin' || user?.role === 'editor';
  const isAdmin = user?.role === 'admin';

  async function loadDirectory() {
    setIsRefreshing(true);
    setError(null);
    try {
      const [loadedSingers, loadedPitches, centers] = await Promise.all([
        fetchSingers(),
        fetchSingerSongPitches(),
        user?.role === 'editor' ? fetchEditableCenters() : fetchAccountCenters(),
      ]);
      setSingers(loadedSingers);
      setPitches(loadedPitches);
      setManagementCenters(centers);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load singers.');
    } finally {
      setIsRefreshing(false);
    }
  }

  function openCreateSinger() {
    setEditingSinger(null);
    setIsSingerFormVisible(true);
  }

  function openEditSinger(singer: Singer) {
    setEditingSinger(singer);
    setIsSingerFormVisible(true);
  }

  async function saveSinger(input: SingerInput) {
    if (editingSinger) {
      await updateSingerProfile(editingSinger.id, input);
    } else {
      await createSingerProfile(input);
    }
    setIsSingerFormVisible(false);
    await loadDirectory();
  }

  function confirmDeleteSinger(singer: Singer) {
    Alert.alert('Delete singer?', `Delete ${singer.name}? Singers with pitch assignments cannot be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setMutatingSingerId(singer.id);
          void deleteSingerProfile(singer.id)
            .then(() => {
              setSingers((current) => current.filter((item) => item.id !== singer.id));
              setError(null);
            })
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to delete singer.'))
            .finally(() => setMutatingSingerId(null));
        },
      },
    ]);
  }

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let isActive = true;
    const centersRequest = user?.role === 'editor' ? fetchEditableCenters() : fetchAccountCenters();
    void Promise.all([fetchSingers(), fetchSingerSongPitches(), centersRequest])
      .then(([loadedSingers, loadedPitches, centers]) => {
        if (!isActive) return;
        setSingers(loadedSingers);
        setPitches(loadedPitches);
        setManagementCenters(centers);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (isActive) setError(cause instanceof Error ? cause.message : 'Unable to load singers.');
      })
      .finally(() => {
        if (isActive) setLoadedForUser(userId);
      });
    return () => {
      isActive = false;
    };
  }, [userId, user?.role]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSingers = useMemo(() => {
    const allowedCenterIds = user?.role === 'editor' ? user.editorFor : user?.centerIds || [];
    return singers
      .filter((singer) => (isAdmin || singer.centerIds.some((centerId) => allowedCenterIds.includes(centerId)))
        && singer.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((first, second) => compareNames(first.name, second.name));
  }, [singers, user, isAdmin, normalizedQuery]);
  const { listRef, windowedItems, availableLetters, scrollToLetter, loadEarlier, loadLater, showIndex } = useAlphabetJump(visibleSingers, getSingerName);

  if (isAuthLoading || (user && loadedForUser !== user.id)) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.forest} />
          <Text style={styles.loadingLabel}>Opening singer directory</Text>
        </View>
      </View>
    );
  }

  if (!user) return <Redirect href="/(tabs)" />;

  const pitchCounts = new Map<string, number>();
  for (const association of pitches) {
    pitchCounts.set(association.singerId, (pitchCounts.get(association.singerId) || 0) + 1);
  }

  return (
    <View style={styles.screen}>
      {canManageSingers ? <AddFab label="Add singer" onPress={openCreateSinger} /> : null}
      <View style={styles.listScreen}>
        <View>
          <View style={styles.header}>
            <Text style={styles.heading}>Singers</Text>
            <Text style={styles.intro}>{formatCount(visibleSingers.length, singers.length)} voices, with their songs and pitches.</Text>
          </View>
          <View style={styles.searchWrap}>
            <Search color={colors.muted} size={18} strokeWidth={1.8} />
            <TextInput
              accessibilityLabel="Search singers"
              onChangeText={setQuery}
              placeholder="Search singers"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
          </View>
        </View>
        <View style={alphabetIndexStyles.listArea}>
        <FlatList
          ref={listRef}
          data={windowedItems}
          onStartReached={loadEarlier}
          onStartReachedThreshold={0.5}
          onEndReached={loadLater}
          onEndReachedThreshold={2}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          keyExtractor={(singer) => singer.id}
          renderItem={({ item }) => {
            const songCount = pitchCounts.get(item.id) || 0;
            const centerNames = item.centerIds
              .map((centerId) => managementCenters.find((center) => center.id === centerId)?.name)
              .filter((name): name is string => Boolean(name));
            const canManageSinger = isAdmin || (user?.role === 'editor' && item.centerIds.some((centerId) => user.editorFor.includes(centerId)));
            return (
              <View style={styles.singerRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${item.name}'s songs`}
                  onPress={() => router.push({ pathname: '/singers/[id]', params: { id: item.id } })}
                  style={({ pressed }) => [styles.singerMain, pressed && styles.rowPressed]}
                >
                  <View style={styles.singerCopy}>
                    <Text numberOfLines={1} style={[styles.singerName, { color: singerNameColor(item.gender) }]}>{item.name}</Text>
                    <Text numberOfLines={2} style={styles.singerMeta}>
                      {[`${songCount} ${songCount === 1 ? 'song' : 'songs'}`, item.gender, centerNames.join(', ') || null].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                </Pressable>
                {canManageSinger ? (
                  <View style={styles.rowActions}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} onPress={() => openEditSinger(item)} style={styles.rowAction}>
                      <Pencil color={colors.forest} size={16} />
                      <Text style={styles.actionHint}>Edit</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.name}`} onPress={() => confirmDeleteSinger(item)} disabled={mutatingSingerId === item.id} style={styles.rowAction}>
                      {mutatingSingerId === item.id ? <ActivityIndicator color={colors.rose} size="small" /> : <Trash2 color={colors.rose} size={17} />}
                      <Text style={styles.deleteHint}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {isRefreshing ? <ActivityIndicator color={colors.forest} /> : <UsersRound color={colors.saffron} size={24} />}
              <Text style={styles.emptyTitle}>{error ? 'Unable to load singers' : isRefreshing ? 'Loading singers' : 'No singers found'}</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          }
          contentContainerStyle={[styles.listContent, showIndex && alphabetIndexStyles.listContentWithIndex]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void loadDirectory()} tintColor={colors.forest} />
          }
          showsVerticalScrollIndicator={false}
        />
        {showIndex ? <AlphabetIndex available={availableLetters} onSelect={scrollToLetter} /> : null}
        </View>
        {user && isSingerFormVisible ? (
          <SingerEditorModal
            singer={editingSinger}
            user={user}
            centers={managementCenters}
            onClose={() => setIsSingerFormVisible(false)}
            onSubmit={saveSinger}
          />
        ) : null}
      </View>
    </View>
  );
}

function getSingerName(singer: Singer) {
  return singer.name;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  listScreen: { flex: 1 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingLabel: { color: colors.muted, fontSize: 13, marginTop: 12 },
  header: { backgroundColor: colors.forest, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 23 },
  heading: { color: '#E6C08B', fontSize: 25, lineHeight: 30, fontWeight: '700', textAlign: 'center', marginTop: -8 },
  intro: { color: '#C3D2C8', fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: 'center' },
  searchWrap: { minHeight: 44, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 7, marginHorizontal: 16, marginTop: -10, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, minHeight: 42, color: colors.ink, fontSize: 13, marginLeft: 8, paddingVertical: 0 },
  listContent: { flexGrow: 1, backgroundColor: colors.paper, paddingHorizontal: 16, paddingBottom: 16 },
  singerRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center' },
  singerMain: { flex: 1, minHeight: 60, paddingLeft: 0, paddingRight: 6, flexDirection: 'row', alignItems: 'center' },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  rowAction: { width: 40, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionHint: { color: colors.forest, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
  deleteHint: { color: colors.rose, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
  rowPressed: { opacity: 0.72 },
  singerCopy: { flex: 1, marginRight: 8 },
  singerName: { color: colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  singerMeta: { color: colors.muted, fontSize: 10 },
  separator: { height: 1, backgroundColor: colors.line },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  emptyTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 18, textAlign: 'center', marginTop: 12 },
  errorText: { color: colors.error, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12 },
});