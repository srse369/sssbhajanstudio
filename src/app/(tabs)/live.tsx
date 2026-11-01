import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Play, Save, Trash2, X } from 'lucide-react-native';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SearchBar } from '../../components/SearchBar';
import { useAuth } from '../../contexts/AuthContext';
import { liveSessionItemKey, useLiveSession } from '../../contexts/LiveSessionContext';
import { savePresentationSession } from '../../lib/presentation';
import { colors } from '../../lib/theme';
import { formatCount } from '../../lib/count';
import { singerNameColor } from '../../lib/singerColors';

export default function LiveScreen() {
  const { user } = useAuth();
  const { items, isLoading, moveSong, moveSongTo, removeItem, clearSession } = useLiveSession();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingItemAction, setPendingItemAction] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [query, setQuery] = useState('');
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.songName, item.singerName, item.pitch, item.deity, item.language].some((value) => value?.toLowerCase().includes(needle)));
  }, [items, query]);
  const canSaveSession = user?.role === 'editor' || user?.role === 'admin';

  async function runItemAction(actionKey: string, action: () => Promise<void>) {
    setPendingItemAction(actionKey);
    try {
      await action();
    } catch (cause) {
      Alert.alert('Unable to update Live queue', cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setPendingItemAction(null);
    }
  }

  async function clearLiveSession() {
    setIsClearing(true);
    try {
      await clearSession();
    } catch (cause) {
      Alert.alert('Unable to clear Live queue', cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setIsClearing(false);
    }
  }

  async function saveSession() {
    if (!sessionName.trim()) {
      setSaveError('Enter a name for this session.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await savePresentationSession(sessionName, items.map(({ songId, singerId, pitch }) => ({ songId, singerId, pitch })));
      setSessionName('');
      setShowSaveModal(false);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to save this session.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      {items.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear Live session"
          disabled={isClearing}
          onPress={() => void clearLiveSession()}
          style={({ pressed }) => [styles.clearFab, pressed && styles.pressed]}
        >
          {isClearing ? <ActivityIndicator color={colors.white} size="small" /> : <Trash2 color={colors.white} size={14} />}
          <Text style={styles.clearFabLabel}>{isClearing ? 'Wait' : 'Clear'}</Text>
        </Pressable>
      ) : null}
      <View style={styles.header}>
        <Text style={styles.heading}>Live</Text>
        <Text style={styles.intro}>
          {items.length ? `${formatCount(visibleItems.length, items.length)} ${items.length === 1 ? 'song' : 'songs'} in your queue.` : 'Build a song queue, then present it from here.'}
        </Text>
      </View>
      <SearchBar label="Search Live queue" value={query} onChangeText={setQuery} />
      <FlatList
        data={visibleItems}
        keyExtractor={liveSessionItemKey}
        contentContainerStyle={[styles.listContent, items.length === 0 && styles.emptyListContent]}
        ItemSeparatorComponent={() => <View style={styles.rowGap} />}
        renderItem={({ item }) => {
          const index = items.indexOf(item);
          const itemKey = liveSessionItemKey(item);
          const upKey = `${itemKey}:up`;
          const downKey = `${itemKey}:down`;
          const topKey = `${itemKey}:top`;
          const bottomKey = `${itemKey}:bottom`;
          const removeKey = `${itemKey}:remove`;
          const subtitleParts = [
            item.singerName ? { value: item.singerName, color: singerNameColor(item.singerGender) } : null,
            item.pitch ? { value: item.pitch } : null,
            item.deity ? { value: item.deity } : null,
            item.language ? { value: item.language } : null,
          ].filter((part): part is { value: string; color?: string } => part !== null);
          return (
            <View style={styles.songRow}>
            <Text style={styles.position}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.songCopy}>
              <Text numberOfLines={2} style={styles.songTitle}>{item.songName}</Text>
              <Text numberOfLines={1} style={styles.songSubtitle}>
                {subtitleParts.length
                  ? subtitleParts.map((part, partIndex) => (
                    <Text key={`${part.value}-${partIndex}`} style={part.color ? { color: part.color } : undefined}>
                      {partIndex ? ' · ' : ''}{part.value}
                    </Text>
                  ))
                  : 'Sai bhajan'}
              </Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${item.songName} to top`}
                accessibilityState={{ disabled: index === 0 || pendingItemAction !== null }}
                disabled={index === 0 || pendingItemAction !== null}
                onPress={() => void runItemAction(topKey, () => moveSongTo(itemKey, 'top'))}
                style={[styles.jumpButton, (index === 0 || pendingItemAction !== null) && styles.disabledButton]}
              >
                {pendingItemAction === topKey ? <ActivityIndicator color={colors.ink} size="small" /> : <ArrowUpToLine color={colors.ink} size={17} />}
                <Text style={styles.jumpActionLabel}>Top</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${item.songName} up`}
                accessibilityState={{ disabled: index === 0 || pendingItemAction !== null }}
                disabled={index === 0 || pendingItemAction !== null}
                onPress={() => void runItemAction(upKey, () => moveSong(itemKey, -1))}
                style={[styles.iconButton, (index === 0 || pendingItemAction !== null) && styles.disabledButton]}
              >
                {pendingItemAction === upKey ? <ActivityIndicator color={colors.ink} size="small" /> : <ArrowUp color={colors.ink} size={17} />}
                <Text style={styles.rowActionLabel}>Up</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${item.songName} down`}
                accessibilityState={{ disabled: index === items.length - 1 || pendingItemAction !== null }}
                disabled={index === items.length - 1 || pendingItemAction !== null}
                onPress={() => void runItemAction(downKey, () => moveSong(itemKey, 1))}
                style={[styles.iconButton, (index === items.length - 1 || pendingItemAction !== null) && styles.disabledButton]}
              >
                {pendingItemAction === downKey ? <ActivityIndicator color={colors.ink} size="small" /> : <ArrowDown color={colors.ink} size={17} />}
                <Text style={styles.rowActionLabel}>Down</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${item.songName} to bottom`}
                accessibilityState={{ disabled: index === items.length - 1 || pendingItemAction !== null }}
                disabled={index === items.length - 1 || pendingItemAction !== null}
                onPress={() => void runItemAction(bottomKey, () => moveSongTo(itemKey, 'bottom'))}
                style={[styles.jumpButton, (index === items.length - 1 || pendingItemAction !== null) && styles.disabledButton]}
              >
                {pendingItemAction === bottomKey ? <ActivityIndicator color={colors.ink} size="small" /> : <ArrowDownToLine color={colors.ink} size={17} />}
                <Text style={styles.jumpActionLabel}>Bottom</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.songName}${item.singerName ? ` for ${item.singerName}` : ''} from Live`}
                accessibilityState={{ disabled: pendingItemAction !== null }}
                disabled={pendingItemAction !== null}
                onPress={() => void runItemAction(removeKey, () => removeItem(itemKey))}
                style={styles.removeButton}
              >
                {pendingItemAction === removeKey ? <ActivityIndicator color={colors.rose} size="small" /> : <Trash2 color={colors.rose} size={17} />}
                <Text numberOfLines={1} style={styles.deleteActionLabel}>Remove</Text>
              </Pressable>
            </View>
            </View>
          );
        }}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{isLoading ? 'Loading your queue' : 'Your Live queue is empty'}</Text>
            <Text style={styles.emptyBody}>Add songs from Songs to build the next session.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/')} style={styles.browseButton}>
              <Text style={styles.browseLabel}>Browse songs</Text>
            </Pressable>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
      <View style={styles.footer}>
        <View style={styles.footerActions}>
          {canSaveSession ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save Live session"
              disabled={!items.length}
              onPress={() => {
                setSaveError(null);
                setShowSaveModal(true);
              }}
              style={[styles.saveButton, !items.length && styles.presentButtonDisabled]}
            >
              <Save color={colors.white} size={14} />
              <Text style={styles.saveLabel}>Save</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Present Live session with ${items.length} songs`}
            disabled={!items.length}
            onPress={() => router.push({ pathname: '/presentation/[id]', params: { id: 'live' } })}
            style={[styles.presentButton, !canSaveSession && styles.presentButtonFull, !items.length && styles.presentButtonDisabled]}
          >
            <Play color={colors.white} fill={colors.white} size={14} />
            <Text style={styles.presentLabel}>Present {items.length ? `(${items.length})` : ''}</Text>
          </Pressable>
        </View>
        {!canSaveSession ? <Text style={styles.accessHint}>Editor access is required to save sessions.</Text> : null}
      </View>
      <Modal
        animationType="slide"
        onRequestClose={() => setShowSaveModal(false)}
        presentationStyle="overFullScreen"
        transparent
        visible={showSaveModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close save session dialog" onPress={() => setShowSaveModal(false)} style={styles.modalScrim} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
            style={styles.keyboardAvoiding}
          >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Save to Presentations</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setShowSaveModal(false)} style={styles.closeButton}>
                <X color={colors.ink} size={19} />
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel="Session name"
              autoCapitalize="sentences"
              autoFocus
              onChangeText={setSessionName}
              onSubmitEditing={() => void saveSession()}
              placeholder="Session name"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={styles.nameInput}
              value={sessionName}
            />
            {saveError ? <Text accessibilityRole="alert" style={styles.saveError}>{saveError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void saveSession()}
              style={[styles.confirmSaveButton, isSaving && styles.presentButtonDisabled]}
            >
              {isSaving ? <ActivityIndicator color={colors.white} size="small" /> : <Save color={colors.white} size={17} />}
              <Text style={styles.presentLabel}>{isSaving ? 'Saving…' : 'Save session'}</Text>
            </Pressable>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.forest, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 23 },
  heading: { color: '#E6C08B', fontSize: 25, lineHeight: 30, fontWeight: '700', textAlign: 'center', marginTop: -8 },
  intro: { color: '#C3D2C8', fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: 'center' },
  clearFab: { position: 'absolute', top: 4, right: 18, zIndex: 5, width: 38, height: 38, borderRadius: 19, backgroundColor: '#426756', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
  clearFabLabel: { color: colors.white, fontSize: 8, lineHeight: 9, fontWeight: '700' },
  listContent: { paddingHorizontal: 14, paddingBottom: 16 },
  emptyListContent: { flexGrow: 1, justifyContent: 'center' },
  rowGap: { height: 1, backgroundColor: colors.line },
  songRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  position: { width: 28, color: colors.saffron, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  songCopy: { flex: 1, marginRight: 4 },
  songTitle: { color: colors.ink, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  songSubtitle: { color: colors.muted, fontSize: 9, marginTop: 2 },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 30, height: 50, alignItems: 'center', justifyContent: 'center', gap: 2 },
  removeButton: { width: 42, height: 50, alignItems: 'center', justifyContent: 'center', gap: 2 },
  jumpButton: { width: 25, height: 50, alignItems: 'center', justifyContent: 'center', gap: 2 },
  rowActionLabel: { color: colors.muted, fontSize: 7, lineHeight: 9, fontWeight: '600' },
  jumpActionLabel: { color: colors.muted, fontSize: 6, lineHeight: 8, fontWeight: '600' },
  deleteActionLabel: { color: colors.rose, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
  disabledButton: { opacity: 0.32 },
  emptyState: { alignItems: 'center', padding: 28 },
  emptyTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 18, textAlign: 'center' },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 270 },
  browseButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 18, marginTop: 16, backgroundColor: colors.sage, borderRadius: 7 },
  browseLabel: { color: colors.forestDeep, fontSize: 13, fontWeight: '600' },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  footerActions: { flexDirection: 'row', gap: 9 },
  saveButton: { flex: 1, minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.forest },
  saveLabel: { color: colors.white, fontSize: 10, fontWeight: '700' },
  presentButton: { flex: 1, minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.forest },
  presentButtonFull: { flex: 1 },
  presentButtonDisabled: { opacity: 0.4 },
  presentLabel: { color: colors.white, fontSize: 10, fontWeight: '700' },
  accessHint: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 29, 23, 0.48)' },
  keyboardAvoiding: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFill },
  modalSheet: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, backgroundColor: colors.paper, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 21 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surface },
  nameInput: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 7, color: colors.ink, fontSize: 14, backgroundColor: colors.surface },
  saveError: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: 8 },
  confirmSaveButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, borderRadius: 8, backgroundColor: colors.forest },
});