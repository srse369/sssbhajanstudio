import { useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PITCH_OPTIONS, pitchOptionLabel } from '../lib/pitch';
import type { Singer, SingerSongPitch, SingerUser } from '../lib/singers';
import type { Song } from '../lib/songs';
import { colors } from '../lib/theme';
import { singerNameColor } from '../lib/singerColors';

interface PitchEditorModalProps {
  visible: boolean;
  pitch: SingerSongPitch | null;
  scope: 'mine' | 'all';
  user: SingerUser;
  songs: Song[];
  singers: Singer[];
  existingPitches: SingerSongPitch[];
  onClose: () => void;
  onSubmit: (input: { songId: string; singerId: string; pitch: string }, existingPitchId?: string) => Promise<void>;
}

type PickerMode = 'song' | 'singer' | 'pitch' | null;

export function PitchEditorModal({ visible, pitch, scope, user, songs, singers, existingPitches, onClose, onSubmit }: PitchEditorModalProps) {
  const [songId, setSongId] = useState(pitch?.songId || '');
  const [singerId, setSingerId] = useState(pitch?.singerId || (scope === 'mine' ? user.id : ''));
  const [pitchValue, setPitchValue] = useState(pitch?.pitch || '');
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateExistingPitchId, setUpdateExistingPitchId] = useState<string | null>(null);

  const selectedSong = songs.find((song) => song.id === songId);
  const selectedSinger = singers.find((singer) => singer.id === singerId);
  const singerLabel = scope === 'mine' ? user.name : selectedSinger?.name;
  const matchingExistingPitch = !pitch && songId && singerId
    ? existingPitches.find((item) => item.songId === songId && item.singerId === singerId) || null
    : null;
  const isEditing = pitch !== null || updateExistingPitchId !== null;
  const filteredSongs = songs.filter((song) => song.name.toLocaleLowerCase().includes(pickerSearch.trim().toLocaleLowerCase()));
  const filteredSingers = singers.filter((singer) => singer.name.toLocaleLowerCase().includes(pickerSearch.trim().toLocaleLowerCase()));

  async function submit() {
    if (!songId || !singerId || !pitchValue) {
      setError('Select a song and pitch before saving.');
      return;
    }
    if (matchingExistingPitch && !isEditing) {
      setError('This singer already has a pitch for this song. Edit the existing pitch to change it.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ songId, singerId, pitch: pitchValue }, pitch?.id || updateExistingPitchId || undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save this pitch.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openPicker(mode: Exclude<PickerMode, null>) {
    setPickerSearch('');
    setPickerMode(mode);
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => pickerMode ? setPickerMode(null) : onClose()}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close pitch editor" onPress={onClose} style={styles.scrim} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoiding}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{pickerMode ? `Select ${pickerMode}` : isEditing ? 'Update pitch' : 'Add pitch'}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={pickerMode ? 'Back to pitch form' : 'Close'} onPress={() => pickerMode ? setPickerMode(null) : onClose()} style={styles.closeButton}>
              <X color={colors.ink} size={19} />
            </Pressable>
          </View>

          {pickerMode ? (
            <>
              {pickerMode !== 'pitch' ? (
                <View style={styles.searchBox}>
                  <Search color={colors.muted} size={17} />
                  <TextInput
                    accessibilityLabel={`Search ${pickerMode}s`}
                    autoFocus
                    onChangeText={setPickerSearch}
                    placeholder={pickerMode === 'song' ? 'Search songs' : 'Search singers'}
                    placeholderTextColor={colors.muted}
                    style={styles.searchInput}
                    value={pickerSearch}
                  />
                </View>
              ) : null}
              <FlatList<Song | Singer | string>
                keyboardShouldPersistTaps="handled"
                data={pickerMode === 'song' ? filteredSongs : pickerMode === 'singer' ? filteredSingers : PITCH_OPTIONS}
                keyExtractor={(item) => typeof item === 'string' ? item : item.id}
                contentContainerStyle={styles.optionsList}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={<Text style={styles.emptyResults}>No matches.</Text>}
                renderItem={({ item }) => {
                  const label = typeof item === 'string' ? pitchOptionLabel(item) : item.name;
                  const selected = pickerMode === 'song'
                    ? typeof item !== 'string' && item.id === songId
                    : pickerMode === 'singer'
                      ? typeof item !== 'string' && item.id === singerId
                      : item === pitchValue;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        if (pickerMode === 'song' && typeof item !== 'string') {
                          setSongId(item.id);
                          setUpdateExistingPitchId(null);
                        } else if (pickerMode === 'singer' && typeof item !== 'string') {
                          setSingerId(item.id);
                          setUpdateExistingPitchId(null);
                        }
                        else if (pickerMode === 'pitch' && typeof item === 'string') setPitchValue(item);
                        setPickerMode(null);
                      }}
                      style={styles.optionRow}
                    >
                      <Text numberOfLines={2} style={[styles.optionLabel, pickerMode === 'singer' && typeof item !== 'string' && 'gender' in item ? { color: singerNameColor(item.gender) } : null]}>{label}</Text>
                      {selected ? <Check color={colors.forest} size={17} /> : null}
                    </Pressable>
                  );
                }}
              />
            </>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>SONG</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isEditing ? `Song ${selectedSong?.name || pitch?.songName}, not editable` : `Select song${selectedSong ? `, ${selectedSong.name}` : ''}`}
                accessibilityState={{ disabled: isEditing }}
                disabled={isEditing}
                onPress={() => openPicker('song')}
                style={[styles.fieldButton, isEditing && styles.disabledField]}
              >
                <Text numberOfLines={2} style={[styles.fieldValue, !selectedSong && styles.placeholder]}>{selectedSong?.name || pitch?.songName || 'Choose a song'}</Text>
                {!isEditing ? <ChevronDown color={colors.muted} size={17} /> : null}
              </Pressable>

              <Text style={styles.fieldLabel}>SINGER</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={scope === 'all' && !isEditing ? `Select singer${selectedSinger ? `, ${selectedSinger.name}` : ''}` : `Singer ${singerLabel || pitch?.singerName}, not editable`}
                accessibilityState={{ disabled: scope === 'mine' || isEditing }}
                disabled={scope === 'mine' || isEditing}
                onPress={() => openPicker('singer')}
                style={[styles.fieldButton, (scope === 'mine' || isEditing) && styles.disabledField]}
              >
                <Text numberOfLines={2} style={[styles.fieldValue, !singerLabel && !pitch?.singerName && styles.placeholder, { color: singerNameColor(selectedSinger?.gender) }]}>{singerLabel || pitch?.singerName || 'Choose a singer'}</Text>
                {scope === 'all' && !isEditing ? <ChevronDown color={colors.muted} size={17} /> : null}
              </Pressable>
              {scope === 'mine' && !isEditing ? <Text style={styles.helperText}>This pitch will be saved under your singer profile.</Text> : null}

              {matchingExistingPitch && !isEditing ? (
                <View style={styles.existingPitchNotice}>
                  <Text style={styles.existingPitchText}>
                    This assignment already exists at {pitchOptionLabel(matchingExistingPitch.pitch)}.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit existing pitch"
                    disabled={!matchingExistingPitch.id}
                    onPress={() => {
                      setPitchValue(matchingExistingPitch.pitch);
                      setUpdateExistingPitchId(matchingExistingPitch.id || null);
                    }}
                    style={[styles.existingPitchAction, !matchingExistingPitch.id && styles.disabledSubmit]}
                  >
                    <Text style={styles.existingPitchActionLabel}>Edit existing pitch</Text>
                  </Pressable>
                </View>
              ) : null}

              {updateExistingPitchId ? <Text style={styles.helperText}>Updating the existing assignment. Song and singer are locked.</Text> : null}

              <Text style={styles.fieldLabel}>PITCH</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Select pitch${pitchValue ? `, ${pitchOptionLabel(pitchValue)}` : ''}`} onPress={() => openPicker('pitch')} style={styles.fieldButton}>
                <Text style={[styles.fieldValue, !pitchValue && styles.placeholder]}>{pitchValue ? pitchOptionLabel(pitchValue) : 'Choose a pitch'}</Text>
                <ChevronDown color={colors.muted} size={17} />
              </Pressable>

              {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
              <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void submit()} style={[styles.submitButton, isSubmitting && styles.disabledSubmit]}>
                {isSubmitting ? <ActivityIndicator color={colors.white} size="small" /> : null}
                <Text style={styles.submitLabel}>{isSubmitting ? 'Saving…' : isEditing ? 'Update pitch' : 'Add pitch'}</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 29, 23, 0.48)' },
  keyboardAvoiding: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill },
  sheet: { maxHeight: '88%', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, backgroundColor: colors.paper, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: colors.ink, fontFamily: 'Georgia', fontSize: 21 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surface },
  searchBox: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface },
  searchInput: { flex: 1, minHeight: 44, color: colors.ink, fontSize: 14 },
  optionsList: { paddingBottom: 12 },
  separator: { height: 1, backgroundColor: colors.line },
  optionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 10 },
  optionLabel: { flex: 1, color: colors.ink, fontSize: 14 },
  emptyResults: { padding: 18, color: colors.muted, textAlign: 'center', fontSize: 13 },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  fieldButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface },
  disabledField: { backgroundColor: '#EDEAE2' },
  fieldValue: { flex: 1, color: colors.ink, fontSize: 14 },
  placeholder: { color: colors.muted },
  helperText: { color: colors.muted, fontSize: 11, marginTop: 6 },
  existingPitchNotice: { marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#D8C398', borderRadius: 7, backgroundColor: '#F5EBD8' },
  existingPitchText: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  existingPitchAction: { minHeight: 36, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 10, marginTop: 6, borderRadius: 6, backgroundColor: colors.sage },
  existingPitchActionLabel: { color: colors.forest, fontSize: 12, fontWeight: '700' },
  errorText: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: 10 },
  submitButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, borderRadius: 8, backgroundColor: colors.forest },
  disabledSubmit: { opacity: 0.55 },
  submitLabel: { color: colors.white, fontSize: 14, fontWeight: '700' },
});