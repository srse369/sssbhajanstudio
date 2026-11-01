import { useCallback, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { ArrowRight, ListMusic, Play, Share2, Trash2 } from 'lucide-react-native';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SearchBar } from '../../components/SearchBar';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveSession, type LiveSessionItem } from '../../contexts/LiveSessionContext';
import { colors } from '../../lib/theme';
import { formatCount } from '../../lib/count';
import { deletePresentationSession, fetchPresentationSessions, type PresentationSession } from '../../lib/presentation';

function shareSession(session: PresentationSession) {
  const link = Linking.createURL(`/presentation/${encodeURIComponent(session.id)}`, { scheme: 'sssbhajanstudio' });
  const count = `${session.items.length} ${session.items.length === 1 ? 'song' : 'songs'}`;
  return Share.share({ message: [`${session.name} (${count})`, `Open in SSS Bhajan Studio: ${link}`].join('\n') });
}

export default function PresentationScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { items: liveItems, isLoading: isLiveLoading, replaceItems } = useLiveSession();
  const [sessions, setSessions] = useState<PresentationSession[]>([]);
  const [query, setQuery] = useState('');
  const visibleSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter((session) => `${session.name} ${session.description || ''}`.toLowerCase().includes(needle));
  }, [sessions, query]);
  const [loadedForAccount, setLoadedForAccount] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accountKey = user?.id || 'public';
  const isLoading = isAuthLoading || loadedForAccount !== accountKey || isRefreshing;

  function canDeleteSession(session: PresentationSession) {
    if (user?.role === 'admin') return true;
    if (user?.role === 'viewer') return session.createdBy === user.email;
    if (user?.role === 'editor') {
      return !session.centerIds?.length || session.centerIds.some((centerId) => user.editorFor.includes(centerId));
    }
    return false;
  }

  function loadSession(session: PresentationSession) {
    const nextItems: LiveSessionItem[] = session.items.map((item) => ({
      songId: item.songId,
      songName: item.songName,
      singerId: item.singerId,
      singerName: item.singerName,
      singerGender: item.singerGender,
      pitch: item.pitch,
      language: item.language,
      deity: item.deity,
    }));
    const confirmLoad = () => {
      setLoadingSessionId(session.id);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void replaceItems(nextItems)
            .then(() => router.navigate('/live'))
            .catch((cause: unknown) => Alert.alert('Unable to load Live queue', cause instanceof Error ? cause.message : 'Please try again.'))
            .finally(() => setLoadingSessionId(null));
        });
      });
    };

    if (liveItems.length) {
      Alert.alert('Load presentation to Live?', 'This will replace the songs currently in your Live queue.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Load', onPress: confirmLoad },
      ]);
    } else {
      confirmLoad();
    }
  }

  function confirmDeleteSession(session: PresentationSession) {
    Alert.alert('Delete presentation?', `Delete ${session.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeletingSessionId(session.id);
          void deletePresentationSession(session.id)
            .then(() => loadSessions())
            .catch((cause: unknown) => Alert.alert('Unable to delete presentation', cause instanceof Error ? cause.message : 'Please try again.'))
            .finally(() => setDeletingSessionId(null));
        },
      },
    ]);
  }

  const loadSessions = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      setSessions(await fetchPresentationSessions());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load presentations.');
    } finally {
      setLoadedForAccount(accountKey);
      setIsRefreshing(false);
    }
  }, [accountKey]);

  useFocusEffect(useCallback(() => {
    if (isAuthLoading) return undefined;
    setLoadingSessionId(null);
    let isActive = true;
    void fetchPresentationSessions()
      .then((loadedSessions) => {
        if (isActive) {
          setSessions(loadedSessions);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (isActive) setError(cause instanceof Error ? cause.message : 'Unable to load presentations.');
      })
      .finally(() => {
        if (isActive) setLoadedForAccount(accountKey);
      });
    return () => {
      isActive = false;
    };
  }, [accountKey, isAuthLoading]));

  return (
    <View style={styles.screen}>
      <View>
        <View style={styles.header}>
          <Text style={styles.heading}>Presentations</Text>
          <Text style={styles.intro}>{formatCount(visibleSessions.length, sessions.length)} {sessions.length === 1 ? 'presentation' : 'presentations'} · choose one to show its songs and lyrics.</Text>
        </View>
        <SearchBar label="Search presentations" value={query} onChangeText={setQuery} />
      </View>
      <FlatList
        style={styles.sessionList}
        data={visibleSessions}
        keyExtractor={(session) => session.id}
        renderItem={({ item }) => {
          const isLoadingSession = loadingSessionId === item.id;
          return (
            <View style={styles.sessionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Present ${item.name}, ${item.items.length} songs`}
              onPress={() => router.push({ pathname: '/presentation/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.sessionMain, pressed && styles.pressed]}
            >
              <View style={styles.sessionCopy}>
                <Text numberOfLines={1} style={styles.sessionName}>{item.name}</Text>
                <Text numberOfLines={1} style={styles.sessionMeta}>
                  {item.items.length} {item.items.length === 1 ? 'song' : 'songs'}{item.description ? `  ·  ${item.description}` : ''}
                </Text>
              </View>
              <View style={styles.presentButton}>
                <Play color={colors.forest} fill={colors.forest} size={16} strokeWidth={1.8} />
                <Text style={styles.presentLabel}>Present</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Load ${item.name} to Live`}
              accessibilityState={{ disabled: isLiveLoading || loadingSessionId !== null }}
              disabled={isLiveLoading || loadingSessionId !== null}
              onPress={() => loadSession(item)}
              style={[styles.actionButton, (isLiveLoading || loadingSessionId !== null) && styles.disabledAction]}
            >
              {isLoadingSession ? <ActivityIndicator color={colors.forest} size="small" /> : <ListMusic color={colors.forest} size={18} strokeWidth={1.8} />}
              <Text style={styles.actionLabel}>{isLoadingSession ? 'Loading' : 'Live'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share ${item.name}`}
              onPress={() => void shareSession(item)}
              style={styles.actionButton}
            >
              <Share2 color={colors.forest} size={18} strokeWidth={1.8} />
              <Text style={styles.actionLabel}>Share</Text>
            </Pressable>
            {canDeleteSession(item) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
                accessibilityState={{ disabled: deletingSessionId === item.id }}
                disabled={deletingSessionId === item.id}
                onPress={() => confirmDeleteSession(item)}
                style={styles.deleteButton}
              >
                {deletingSessionId === item.id
                  ? <ActivityIndicator color={colors.rose} size="small" />
                  : <Trash2 color={colors.rose} size={18} strokeWidth={1.8} />}
                <Text style={styles.deleteLabel}>Delete</Text>
              </Pressable>
            ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {isLoading ? <ActivityIndicator color={colors.forest} /> : <ArrowRight color={colors.saffron} size={22} />}
            <Text style={styles.emptyTitle}>
              {error ? 'Unable to load sessions' : isLoading ? 'Loading sessions' : 'No sessions available'}
            </Text>
            <Text style={styles.emptyBody}>
              {error || (isLoading
                ? ''
                : !user
                  ? 'These sessions are limited to Sai centers. Sign in from the profile button to see the sessions shared with you.'
                  : 'No sessions are currently shared with your account.')}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadSessions()} tintColor={colors.forest} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  sessionList: { flex: 1 },
  listContent: { flexGrow: 1, backgroundColor: colors.paper, paddingHorizontal: 16, paddingBottom: 16 },
  header: { backgroundColor: colors.forest, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 23 },
  heading: { color: '#E6C08B', fontSize: 25, lineHeight: 30, fontWeight: '700', textAlign: 'center', marginTop: -8 },
  intro: { color: '#C3D2C8', fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: 'center' },
  sessionRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  sessionMain: { flex: 1, minHeight: 62, flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.72 },
  sessionCopy: { flex: 1, marginRight: 8 },
  sessionName: { color: colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  sessionMeta: { color: colors.muted, fontSize: 10 },
  presentButton: { width: 40, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  presentLabel: { color: colors.forest, fontSize: 8, lineHeight: 10, fontWeight: '600' },
  actionButton: { width: 40, height: 52, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionLabel: { color: colors.forest, fontSize: 8, lineHeight: 10, fontWeight: '600' },
  disabledAction: { opacity: 0.45 },
  deleteButton: { width: 40, height: 52, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 },
  deleteLabel: { color: colors.rose, fontSize: 8, lineHeight: 10, fontWeight: '600' },
  separator: { height: 1, backgroundColor: colors.line },
  emptyState: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 38 },
  emptyTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 18, textAlign: 'center', marginTop: 12 },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 280 },
});