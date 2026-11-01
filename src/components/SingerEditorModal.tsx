import { useState } from 'react';
import { Check, X } from 'lucide-react-native';
import {
  ActivityIndicator,
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
import type { Singer, SingerUser, AccountCenter, SingerInput } from '../lib/singers';
import { colors } from '../lib/theme';

interface SingerEditorModalProps {
  singer: Singer | null;
  user: SingerUser;
  centers: AccountCenter[];
  onClose: () => void;
  onSubmit: (input: SingerInput) => Promise<void>;
}

const GENDERS = ['Male', 'Female', 'Boy', 'Girl', 'Other'] as const;

export function SingerEditorModal({ singer, user, centers, onClose, onSubmit }: SingerEditorModalProps) {
  const isAdmin = user.role === 'admin';
  const allowedCenterIds = centers.map((center) => center.id);
  const fixedCenterIds = !isAdmin
    ? (singer?.centerIds || []).filter((centerId) => !allowedCenterIds.includes(centerId))
    : [];
  const [name, setName] = useState(singer?.name || '');
  const [gender, setGender] = useState(singer?.gender || '');
  const [email, setEmail] = useState(singer?.email || '');
  const [selectedCenterIds, setSelectedCenterIds] = useState<number[]>(
    (singer?.centerIds || []).filter((centerId) => isAdmin || allowedCenterIds.includes(centerId)),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    const trimmedName = name.trim();
    const centerIds = [...new Set([...fixedCenterIds, ...selectedCenterIds])];
    if (!trimmedName) {
      setError('Singer name is required.');
      return;
    }
    if (!gender) {
      setError('Select a gender.');
      return;
    }
    if (centerIds.length === 0) {
      setError('Select at least one center.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSubmit({ name: trimmedName, gender, email: email.trim() || undefined, centerIds });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save singer.');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleCenter(centerId: number) {
    setSelectedCenterIds((current) => current.includes(centerId)
      ? current.filter((id) => id !== centerId)
      : [...current, centerId]);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close singer form" onPress={onClose} style={styles.scrim} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoiding}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{singer ? 'Edit singer' : 'Add singer'}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}>
              <X color={colors.ink} size={19} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput accessibilityLabel="Singer name" onChangeText={setName} placeholder="Singer name" placeholderTextColor={colors.muted} style={styles.input} value={name} />
            <Text style={styles.fieldLabel}>GENDER</Text>
            <View style={styles.genderOptions}>
              {GENDERS.map((option) => {
                const selected = gender === option;
                return (
                  <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setGender(option)} style={[styles.genderOption, selected && styles.genderOptionSelected]}>
                    <Text style={[styles.genderLabel, selected && styles.genderLabelSelected]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>EMAIL (OPTIONAL)</Text>
            <TextInput accessibilityLabel="Singer email" autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={colors.muted} style={styles.input} value={email} />
            <Text style={styles.fieldLabel}>CENTERS</Text>
            {fixedCenterIds.length ? (
              <View style={styles.fixedCenters}>
                <Text style={styles.fixedCenterLabel}>Other existing centers are preserved:</Text>
                {fixedCenterIds.map((centerId) => (
                  <Text key={centerId} style={styles.fixedCenterName}>{centers.find((center) => center.id === centerId)?.name || `Center ${centerId}`}</Text>
                ))}
              </View>
            ) : null}
            {centers.map((center) => {
              const selected = selectedCenterIds.includes(center.id);
              return (
                <Pressable key={center.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleCenter(center.id)} style={styles.centerOption}>
                  <Text numberOfLines={1} style={styles.centerName}>{center.name}</Text>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Check color={colors.white} size={13} /> : null}</View>
                </Pressable>
              );
            })}
            {centers.length === 0 ? <Text style={styles.emptyCenters}>No centers are available for your account.</Text> : null}
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void submit()} style={[styles.saveButton, isSaving && styles.disabledButton]}>
              {isSaving ? <ActivityIndicator color={colors.white} size="small" /> : null}
              <Text style={styles.saveLabel}>{isSaving ? 'Saving…' : singer ? 'Save changes' : 'Add singer'}</Text>
            </Pressable>
          </ScrollView>
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
  sheet: { maxHeight: '92%', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26, backgroundColor: colors.paper, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { color: colors.ink, fontFamily: 'Georgia', fontSize: 21 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surface },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface, color: colors.ink, fontSize: 14 },
  genderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  genderOption: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface },
  genderOptionSelected: { borderColor: colors.forest, backgroundColor: colors.sage },
  genderLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  genderLabelSelected: { color: colors.forest, fontWeight: '700' },
  fixedCenters: { padding: 10, marginBottom: 6, borderRadius: 7, backgroundColor: '#EDEAE2' },
  fixedCenterLabel: { color: colors.muted, fontSize: 10, marginBottom: 4 },
  fixedCenterName: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  centerOption: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  centerName: { flex: 1, color: colors.ink, fontSize: 13 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: colors.muted, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  emptyCenters: { color: colors.muted, fontSize: 12, paddingVertical: 12 },
  errorText: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: 10 },
  saveButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, borderRadius: 8, backgroundColor: colors.forest },
  disabledButton: { opacity: 0.55 },
  saveLabel: { color: colors.white, fontSize: 14, fontWeight: '700' },
});