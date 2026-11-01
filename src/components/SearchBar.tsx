import { Search } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors } from '../lib/theme';

export function SearchBar({ label, value, onChangeText, overlap = -10 }: { label: string; value: string; onChangeText: (text: string) => void; overlap?: number }) {
  return (
    <View style={[styles.wrap, { marginTop: overlap }]}>
      <Search color={colors.muted} size={18} strokeWidth={1.8} />
      <TextInput
        accessibilityLabel={label}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 44, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 7, marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 42, color: colors.ink, fontSize: 13, marginLeft: 8, paddingVertical: 0 },
});
