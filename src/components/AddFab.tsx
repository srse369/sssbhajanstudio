import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

export function AddFab({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Plus color="#FFFFFF" size={20} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    top: 4,
    right: 18,
    zIndex: 5,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#426756',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
});
