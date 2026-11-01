import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { liveSessionItemKey, useLiveSession } from '../contexts/LiveSessionContext';
import { parseLiveShare } from '../lib/liveShare';
import { colors } from '../lib/theme';

export default function ImportLiveScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { items: currentItems, replaceItems } = useLiveSession();
  const incoming = useMemo(() => parseLiveShare(q), [q]);
  const [isWorking, setIsWorking] = useState(false);

  async function load(mode: 'replace' | 'add') {
    setIsWorking(true);
    try {
      if (mode === 'replace') {
        await replaceItems(incoming);
      } else {
        const existing = new Set(currentItems.map(liveSessionItemKey));
        await replaceItems([...currentItems, ...incoming.filter((item) => !existing.has(liveSessionItemKey(item)))]);
      }
      router.replace('/live');
    } catch (cause) {
      Alert.alert('Unable to load Live session', cause instanceof Error ? cause.message : 'Please try again.');
      setIsWorking(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Shared Live session</Text>
      {incoming.length === 0 ? (
        <>
          <Text style={styles.body}>This link doesn’t contain any songs.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/live')} style={styles.secondary}>
            <Text style={styles.secondaryLabel}>Go to Live</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.body}>{incoming.length} {incoming.length === 1 ? 'song' : 'songs'} shared with you.</Text>
          <ScrollView style={styles.list}>
            {incoming.map((item, index) => (
              <Text key={`${liveSessionItemKey(item)}-${index}`} style={styles.row}>
                {index + 1}. {item.songName}{item.singerName ? ` – ${item.singerName}` : ''}{item.pitch ? `: ${item.pitch}` : ''}
              </Text>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" disabled={isWorking} onPress={() => void load('replace')} style={styles.primary}>
            {isWorking ? <ActivityIndicator color={colors.white} size="small" /> : null}
            <Text style={styles.primaryLabel}>Replace my Live queue</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={isWorking} onPress={() => void load('add')} style={styles.secondary}>
            <Text style={styles.secondaryLabel}>Add to my Live queue</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={isWorking} onPress={() => router.replace('/live')} style={styles.cancel}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 20 },
  title: { color: colors.ink, fontFamily: 'Georgia', fontSize: 22 },
  body: { color: colors.muted, fontSize: 13, marginTop: 6, marginBottom: 12 },
  list: { flex: 1, marginBottom: 12 },
  row: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  primary: { minHeight: 46, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.forest },
  primaryLabel: { color: colors.white, fontSize: 13, fontWeight: '700' },
  secondary: { minHeight: 46, marginTop: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.forest },
  secondaryLabel: { color: colors.forest, fontSize: 13, fontWeight: '700' },
  cancel: { minHeight: 40, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { color: colors.muted, fontSize: 13 },
});
