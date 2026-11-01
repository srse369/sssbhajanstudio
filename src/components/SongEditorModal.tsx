import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { PITCH_OPTIONS, pitchOptionLabel } from '../lib/pitch';
import type { Song, SongInput } from '../lib/songs';
import { colors } from '../lib/theme';

interface SongEditorModalProps {
  visible: boolean;
  song: Song | null;
  onClose: () => void;
  onSubmit: (input: SongInput) => Promise<void>;
}

export function SongEditorModal({ visible, song, onClose, onSubmit }: SongEditorModalProps) {
  const [name, setName] = useState(song?.name || '');
  const [externalSourceUrl, setExternalSourceUrl] = useState(song?.externalSourceUrl || '');
  const [language, setLanguage] = useState(song?.language || '');
  const [deity, setDeity] = useState(song?.deity || '');
  const [lyrics, setLyrics] = useState(song?.lyrics || '');
  const [meaning, setMeaning] = useState(song?.meaning || '');
  const [tempo, setTempo] = useState(song?.tempo || '');
  const [beat, setBeat] = useState(song?.beat || '');
  const [raga, setRaga] = useState(song?.raga || '');
  const [level, setLevel] = useState(song?.level || '');
  const [songTags, setSongTags] = useState(song?.songTags || '');
  const [audioLink, setAudioLink] = useState(song?.audioLink || '');
  const [videoLink, setVideoLink] = useState(song?.videoLink || '');
  const [goldenVoice, setGoldenVoice] = useState(song?.goldenVoice || false);
  const [refGents, setRefGents] = useState(song?.refGents || '');
  const [refLadies, setRefLadies] = useState(song?.refLadies || '');
  const [pitchPicker, setPitchPicker] = useState<'gents' | 'ladies' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    if (!name.trim() || !language.trim() || !deity.trim() || !lyrics.trim()) {
      setError('Name, language, deity, and lyrics are required.');
      return;
    }
    if (externalSourceUrl.trim()) {
      try {
        new URL(externalSourceUrl.trim());
      } catch {
        setError('Enter a valid external source URL.');
        return;
      }
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        externalSourceUrl: externalSourceUrl.trim() || undefined,
        language: language.trim(),
        deity: deity.trim(),
        lyrics: lyrics.trim(),
        meaning: meaning.trim() || undefined,
        tempo: tempo.trim() || undefined,
        beat: beat.trim() || undefined,
        raga: raga.trim() || undefined,
        level: level.trim() || undefined,
        songTags: songTags.trim() || undefined,
        audioLink: audioLink.trim() || undefined,
        videoLink: videoLink.trim() || undefined,
        goldenVoice,
        refGents: refGents.trim() || undefined,
        refLadies: refLadies.trim() || undefined,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save song.');
    } finally {
      setIsSaving(false);
    }
  }

  function closeTop() {
    if (pitchPicker) setPitchPicker(null);
    else onClose();
  }

  function field(label: string, value: string, setValue: (text: string) => void, options: { required?: boolean; multiline?: boolean; placeholder?: string; hint?: string } = {}) {
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}{options.required ? ' *' : ''}</Text>
        <TextInput
          accessibilityLabel={label}
          multiline={options.multiline}
          onChangeText={setValue}
          placeholder={options.placeholder || label}
          placeholderTextColor={colors.muted}
          style={[styles.input, options.multiline && styles.multilineInput]}
          textAlignVertical={options.multiline ? 'top' : 'center'}
          value={value}
        />
        {options.hint ? <Text style={styles.hint}>{options.hint}</Text> : null}
      </View>
    );
  }

  function pitchField(label: string, value: string, which: 'gents' | 'ladies', hint: string) {
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value || 'not set'}`} onPress={() => setPitchPicker(which)} style={[styles.input, styles.selectInput]}>
          <Text numberOfLines={1} style={[styles.selectText, !value && styles.selectPlaceholder]}>{value ? pitchOptionLabel(value) : 'Select pitch'}</Text>
          <ChevronDown color={colors.muted} size={16} />
        </Pressable>
        <Text style={styles.hint}>{hint}</Text>
      </View>
    );
  }

  return (
    <Modal animationType="slide" onRequestClose={closeTop} presentationStyle="overFullScreen" transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close song editor" onPress={closeTop} style={styles.scrim} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoiding}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{pitchPicker ? `${pitchPicker === 'gents' ? 'Gents' : 'Ladies'} reference` : song ? 'Edit bhajan' : 'Add bhajan'}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={pitchPicker ? 'Close pitch list' : 'Close'} onPress={closeTop} style={styles.closeButton}>
              <X color={colors.ink} size={19} />
            </Pressable>
          </View>
          {song?.externalSourceUrl ? (
            <Text style={styles.sourceNotice}>This song links to an external source; manual changes may be overwritten when synced.</Text>
          ) : null}
          {pitchPicker ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable accessibilityRole="button" onPress={() => setPitchPicker(null)} style={styles.optionRow}>
                <Text style={styles.optionMuted}>None</Text>
              </Pressable>
              {PITCH_OPTIONS.map((option) => {
                const selected = (pitchPicker === 'gents' ? refGents : refLadies) === option;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option}
                    onPress={() => {
                      (pitchPicker === 'gents' ? setRefGents : setRefLadies)(option);
                      setPitchPicker(null);
                    }}
                    style={[styles.optionRow, selected && styles.optionSelected]}
                  >
                    <Text style={styles.optionLabel}>{pitchOptionLabel(option)}</Text>
                    {selected ? <Check color={colors.forest} size={16} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {field('Song name', name, setName, { required: true })}
            {field('Language', language, setLanguage, { required: true, placeholder: 'e.g., sanskrit / hindi', hint: 'Language of the lyrics, e.g. sanskrit / hindi, english, telugu, tamil. Separate several with commas.' })}
            {field('Deity', deity, setDeity, { required: true, placeholder: 'e.g., sai, krishna', hint: 'Who the song is addressed to, e.g. sai, krishna, shiva, devi, ganesha, rama. Separate several with commas.' })}
            {field('Lyrics', lyrics, setLyrics, { required: true, multiline: true })}
            {field('Meaning / translation', meaning, setMeaning, { multiline: true })}
            {field('External source URL', externalSourceUrl, setExternalSourceUrl, { placeholder: 'https://…' })}
            <View style={styles.twoColumns}>
              {field('Tempo', tempo, setTempo, { placeholder: 'e.g., medium', hint: 'slow, medium slow, medium, medium fast or fast' })}
              {field('Beat', beat, setBeat, { placeholder: 'e.g., 8 beat / keherwa / adi', hint: 'Rhythm or tala, e.g. 8 beat / keherwa / adi, 6 beat / dadra' })}
            </View>
            <View style={styles.twoColumns}>
              {field('Raga', raga, setRaga, { placeholder: 'e.g., hamsadhwani', hint: 'Musical scale, e.g. hamsadhwani, bhairavi' })}
              {field('Level', level, setLevel, { placeholder: 'e.g., simple', hint: 'Difficulty: simple, intermediate or advanced' })}
            </View>
            {field('Song tags', songTags, setSongTags, { placeholder: 'Comma-separated tags' })}
            {field('Audio URL', audioLink, setAudioLink, { placeholder: 'https://…' })}
            {field('Video URL', videoLink, setVideoLink, { placeholder: 'https://…' })}
            <View style={styles.referenceRow}>
              {pitchField('Gents reference', refGents, 'gents', 'Suggested starting pitch for male singers')}
              {pitchField('Ladies reference', refLadies, 'ladies', 'Suggested starting pitch for female singers')}
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Golden voice</Text>
              <Switch value={goldenVoice} onValueChange={setGoldenVoice} trackColor={{ true: colors.forest }} />
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void submit()} style={[styles.submitButton, isSaving && styles.disabled]}>
              {isSaving ? <ActivityIndicator color={colors.white} size="small" /> : null}
              <Text style={styles.submitLabel}>{isSaving ? 'Saving…' : song ? 'Save changes' : 'Add bhajan'}</Text>
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
  sheet: { maxHeight: '94%', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, backgroundColor: colors.paper, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: colors.ink, fontFamily: 'Georgia', fontSize: 20 },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.surface },
  sourceNotice: { color: '#765321', fontSize: 11, lineHeight: 16, padding: 9, marginBottom: 6, backgroundColor: '#F5EBD8', borderRadius: 6 },
  field: { flex: 1, marginBottom: 9 },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 4 },
  input: { minHeight: 40, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.surface, color: colors.ink, fontSize: 13 },
  multilineInput: { minHeight: 88, paddingTop: 9 },
  hint: { color: colors.muted, fontSize: 10, lineHeight: 13, marginTop: 3 },
  selectInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { flex: 1, color: colors.ink, fontSize: 13 },
  selectPlaceholder: { color: colors.muted },
  optionRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionSelected: { backgroundColor: colors.sage },
  optionLabel: { color: colors.ink, fontSize: 14 },
  optionMuted: { color: colors.muted, fontSize: 14 },
  twoColumns: { flexDirection: 'row', gap: 9 },
  referenceRow: { flexDirection: 'row', gap: 9 },
  switchRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { color: colors.rose, fontSize: 12, lineHeight: 17, marginTop: 7 },
  submitButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, borderRadius: 8, backgroundColor: colors.forest },
  submitLabel: { color: colors.white, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});