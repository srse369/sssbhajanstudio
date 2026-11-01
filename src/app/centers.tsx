import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Check, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { SearchBar } from '../components/SearchBar';
import { useAuth } from '../contexts/AuthContext';
import { createAccountCenter, deleteAccountCenter, fetchAccountCenters, fetchSingers, updateAccountCenter, type AccountCenter, type Singer } from '../lib/singers';
import { colors } from '../lib/theme';
import { formatCount } from '../lib/count';

const COLOR_OPTIONS = ['#21483B', '#1E40AF', '#A64D43', '#C17A38', '#65518A', '#287D83'];

export default function CentersScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [query, setQuery] = useState('');
  const [centers, setCenters] = useState<AccountCenter[]>([]);
  const visibleCenters = centers.filter((center) => center.name.toLowerCase().includes(query.trim().toLowerCase()));
  const [users, setUsers] = useState<Singer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingCenter, setEditingCenter] = useState<AccountCenter | null>(null);
  const [name, setName] = useState('');
  const [badgeTextColor, setBadgeTextColor] = useState(COLOR_OPTIONS[0]);
  const [editorIds, setEditorIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCenterId, setDeletingCenterId] = useState<number | null>(null);

  async function loadData(refresh = false) {
    if (refresh) setIsRefreshing(true);
    setError(null);
    try {
      const [loadedCenters, loadedUsers] = await Promise.all([fetchAccountCenters(), fetchSingers()]);
      setCenters(loadedCenters);
      setUsers(loadedUsers.filter((singer) => singer.email?.trim()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load centers.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    let active = true;
    void Promise.all([fetchAccountCenters(), fetchSingers()])
      .then(([loadedCenters, loadedUsers]) => {
        if (!active) return;
        setCenters(loadedCenters);
        setUsers(loadedUsers.filter((singer) => singer.email?.trim()));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load centers.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  function openForm(center?: AccountCenter) {
    setEditingCenter(center || null);
    setName(center?.name || '');
    setBadgeTextColor(center?.badgeTextColor || COLOR_OPTIONS[0]);
    setEditorIds(center?.editorIds || []);
    setFormError(null);
    setIsFormVisible(true);
  }

  async function saveCenter() {
    if (!name.trim()) {
      setFormError('Center name is required.');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    const payload = { name: name.trim(), badgeTextColor, editorIds };
    try {
      const savedCenter = editingCenter
        ? await updateAccountCenter(editingCenter.id, payload)
        : await createAccountCenter(payload);
      setCenters((current) => editingCenter
        ? current.map((center) => center.id === savedCenter.id ? savedCenter : center)
        : [...current, savedCenter].sort((first, second) => first.name.localeCompare(second.name)));
      setIsFormVisible(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Unable to save center.');
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete(center: AccountCenter) {
    Alert.alert('Delete center?', `Delete ${center.name}? Centers with singers or sessions cannot be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeletingCenterId(center.id);
          void deleteAccountCenter(center.id)
            .then(() => {
              setCenters((current) => current.filter((item) => item.id !== center.id));
              setError(null);
            })
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to delete center.'))
            .finally(() => setDeletingCenterId(null));
        },
      },
    ]);
  }

  function toggleEditor(userId: string) {
    setEditorIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  }

  if (isAuthLoading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.forest} /></View>;
  }

  if (user?.role !== 'admin') {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={colors.white} size={20} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.heading}>Centers</Text>
          </View>
        </View>
        <Text style={styles.accessDenied}>Only administrators can manage centers.</Text>
      </View>
    );
  }

  if (isLoading) return <View style={styles.loading}><ActivityIndicator color={colors.forest} /></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.white} size={20} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.heading}>Centers</Text>
          <Text style={styles.intro}>{formatCount(visibleCenters.length, centers.length)} centers · assign editors to manage each one</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add center" onPress={() => openForm()} style={styles.addButton}>
          <Plus color={colors.white} size={18} />
        </Pressable>
      </View>
      <SearchBar label="Search centers" value={query} onChangeText={setQuery} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <FlatList
        data={visibleCenters}
        keyExtractor={(center) => String(center.id)}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadData(true)} tintColor={colors.forest} />}
        renderItem={({ item }) => (
          <View style={styles.centerRow}>
            <View style={[styles.colorMark, { backgroundColor: item.badgeTextColor || colors.forest }]} />
            <View style={styles.centerCopy}>
              <Text numberOfLines={1} style={styles.centerName}>{item.name}</Text>
              <Text style={styles.centerMeta}>{item.singerCount ?? 0} singers · {item.editorIds?.length || 0} editors</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} onPress={() => openForm(item)} style={styles.rowButton}>
              <Pencil color={colors.forest} size={16} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.name}`} accessibilityState={{ disabled: deletingCenterId === item.id }} disabled={deletingCenterId === item.id} onPress={() => confirmDelete(item)} style={styles.rowButton}>
              {deletingCenterId === item.id ? <ActivityIndicator color={colors.rose} size="small" /> : <Trash2 color={colors.rose} size={17} />}
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{error || 'No centers found.'}</Text>}
      />
      <Modal animationType="slide" onRequestClose={() => setIsFormVisible(false)} presentationStyle="overFullScreen" transparent visible={isFormVisible}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close center form" onPress={() => setIsFormVisible(false)} style={styles.modalScrim} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoiding}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{editingCenter ? 'Edit center' : 'Add center'}</Text>
            <Text style={styles.fieldLabel}>CENTER NAME</Text>
            <TextInput accessibilityLabel="Center name" onChangeText={setName} placeholder="Center name" placeholderTextColor={colors.muted} style={styles.input} value={name} />
            <Text style={styles.fieldLabel}>BADGE COLOR</Text>
            <View style={styles.colors}>
              {COLOR_OPTIONS.map((color) => (
                <Pressable key={color} accessibilityRole="radio" accessibilityLabel={`Select ${color}`} accessibilityState={{ selected: color === badgeTextColor }} onPress={() => setBadgeTextColor(color)} style={[styles.colorSwatch, { backgroundColor: color }, color === badgeTextColor && styles.colorSwatchSelected]} />
              ))}
            </View>
            <Text style={styles.fieldLabel}>CENTER EDITORS</Text>
            <ScrollView style={styles.editorList} nestedScrollEnabled>
              {users.map((editor) => {
                const selected = editorIds.includes(editor.id);
                return (
                  <Pressable key={editor.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleEditor(editor.id)} style={styles.editorRow}>
                    <View style={styles.editorCopy}>
                      <Text style={styles.editorName}>{editor.name}</Text>
                      <Text numberOfLines={1} style={styles.editorEmail}>{editor.email}</Text>
                    </View>
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Check color={colors.white} size={13} /> : null}</View>
                  </Pressable>
                );
              })}
            </ScrollView>
            {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
            <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void saveCenter()} style={[styles.saveButton, isSaving && styles.disabled]}>
              {isSaving ? <ActivityIndicator color={colors.white} size="small" /> : null}
              <Text style={styles.saveLabel}>{isSaving ? 'Saving…' : editingCenter ? 'Save changes' : 'Add center'}</Text>
            </Pressable>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  header: { backgroundColor: colors.forest, paddingLeft: 12, paddingRight: 16, paddingTop: 2, paddingBottom: 23, flexDirection: 'row', alignItems: 'center' },
  headerCopy: { flex: 1 },
  backButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' },
  addButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#426756' },
  heading: { color: '#E6C08B', fontSize: 25, lineHeight: 30, fontWeight: '700', textAlign: 'center', marginTop: -8 },
  intro: { color: '#C3D2C8', fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: 'center' },
  error: { color: colors.rose, fontSize: 12, lineHeight: 18, marginHorizontal: 18, marginTop: 10 },
  listContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 18 },
  separator: { height: 1, backgroundColor: colors.line },
  centerRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  colorMark: { width: 7, height: 30, borderRadius: 4, marginRight: 4 },
  centerCopy: { flex: 1 },
  centerName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  centerMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  rowButton: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.muted, fontSize: 13, textAlign: 'center', padding: 28 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 29, 23, 0.48)' },
  keyboardAvoiding: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFill },
  modalSheet: { maxHeight: '88%', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 26, backgroundColor: colors.paper, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 21, marginBottom: 8 },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface, color: colors.ink, fontSize: 14 },
  colors: { flexDirection: 'row', gap: 11, paddingVertical: 4 },
  colorSwatch: { width: 30, height: 30, borderRadius: 15 },
  colorSwatchSelected: { borderWidth: 3, borderColor: colors.ink },
  editorList: { maxHeight: 190, borderTopWidth: 1, borderTopColor: colors.line },
  editorRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  editorCopy: { flex: 1 },
  editorName: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  editorEmail: { color: colors.muted, fontSize: 10, marginTop: 3 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: colors.muted, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  saveButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, borderRadius: 8, backgroundColor: colors.forest },
  saveLabel: { color: colors.white, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  accessDenied: { color: colors.muted, fontSize: 14, textAlign: 'center', margin: 30 },
});