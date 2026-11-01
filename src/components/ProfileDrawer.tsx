import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, BadgeCheck, Building2, CircleUserRound, LogOut, MessageSquare, ShieldCheck, X } from 'lucide-react-native';
import { FeedbackForm } from './FeedbackForm';
import { OtpSignInPanel } from './OtpSignInPanel';
import { useAuth } from '../contexts/AuthContext';
import { useLiveSession } from '../contexts/LiveSessionContext';
import { fetchAccountCenters, type AccountCenter } from '../lib/singers';
import { colors } from '../lib/theme';

interface ProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileButton() {
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={user ? `Open profile for ${user.email}` : 'Sign in or view profile'}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.profileButton, pressed && styles.buttonPressed]}
      >
        <CircleUserRound color={colors.white} size={20} strokeWidth={1.8} />
        {user ? <View style={styles.onlineDot} /> : null}
      </Pressable>
      <ProfileDrawer visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

function ProfileDrawer({ visible, onClose }: ProfileDrawerProps) {
  const { width } = useWindowDimensions();
  const { user, setUser, signOut } = useAuth();
  const { clearSession, isLoading: isLiveSessionLoading } = useLiveSession();
  const [centers, setCenters] = useState<AccountCenter[]>([]);
  const [centersForUser, setCentersForUser] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const signInOffsetY = useRef(0);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const drawerWidth = Math.min(390, width * 0.9);
  const [translateX] = useState(() => new Animated.Value(drawerWidth));
  const isLoadingCenters = Boolean(user && centersForUser !== user.id);

  useEffect(() => {
    if (!visible || !user) return;
    let isActive = true;
    const userId = user.id;
    void fetchAccountCenters()
      .then((loadedCenters) => {
        if (isActive) {
          setCenters(loadedCenters);
          setCentersForUser(userId);
        }
      })
      .catch(() => {
        if (isActive) {
          setCenters([]);
          setCentersForUser(userId);
        }
      });
    return () => {
      isActive = false;
    };
  }, [visible, user]);

  useEffect(() => {
    if (!visible) {
      translateX.setValue(drawerWidth);
      return;
    }
    translateX.setValue(drawerWidth);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [drawerWidth, translateX, visible]);

  function closeDrawer() {
    Animated.timing(translateX, {
      toValue: drawerWidth,
      duration: 190,
      useNativeDriver: true,
    }).start(() => onClose());
  }

  function openCenterManagement() {
    Animated.timing(translateX, {
      toValue: drawerWidth,
      duration: 190,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      router.push('/centers');
    });
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setLogoutError(null);
    const [queueResult, logoutResult] = await Promise.allSettled([clearSession(), signOut()]);
    setCenters([]);
    if (queueResult.status === 'rejected' || logoutResult.status === 'rejected') {
      const message = queueResult.status === 'rejected'
        ? 'You were signed out, but the Live queue could not be cleared from this device.'
        : 'You were signed out locally, but the server logout failed.';
      setLogoutError(message);
      Alert.alert('Sign out issue', message);
    } else {
      closeDrawer();
    }
    setIsSigningOut(false);
  }

  const roleName = user?.role === 'admin' ? 'Admin' : user?.role === 'editor' ? 'Editor' : 'Viewer';
  const centerName = (id: number) => centers.find((center) => center.id === id)?.name || `Center ${id}`;

  return (
    <Modal
      animationType="none"
      onRequestClose={closeDrawer}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <SafeAreaProvider style={styles.modalSafeAreaProvider}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close profile drawer" onPress={closeDrawer} style={styles.backdrop} />
          <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Your profile</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close profile drawer" onPress={closeDrawer} style={styles.closeButton}>
                <X color={colors.white} size={19} strokeWidth={1.8} />
              </Pressable>
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.drawerScroll}>
            <ScrollView ref={scrollRef} contentContainerStyle={styles.drawerContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {user ? (
                <>
                  <View style={styles.identityCard}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{(user.name || user.email).trim().charAt(0).toLocaleUpperCase()}</Text></View>
                    <Text numberOfLines={1} style={styles.userName}>{user.name || 'Sai Songs user'}</Text>
                    <Text numberOfLines={2} style={styles.userEmail}>{user.email}</Text>
                    <View style={styles.statusBadge}>
                      <BadgeCheck color={colors.forest} size={15} />
                      <Text style={styles.statusText}>Signed in · {roleName}</Text>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                      <ShieldCheck color={colors.forest} size={17} />
                      <Text style={styles.sectionTitle}>Access</Text>
                    </View>
                    <View style={styles.statusLine}>
                      <Text style={styles.statusLabel}>Account status</Text>
                      <Text style={styles.statusValue}>Active</Text>
                    </View>
                    <View style={styles.statusLine}>
                      <Text style={styles.statusLabel}>Admin</Text>
                      <Text style={styles.statusValue}>{user.role === 'admin' ? 'Yes' : 'No'}</Text>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                      <Building2 color={colors.forest} size={17} />
                      <Text style={styles.sectionTitle}>Center access</Text>
                    </View>
                    {isLoadingCenters ? (
                      <ActivityIndicator color={colors.forest} style={styles.centerLoader} />
                    ) : (
                      <>
                        <Text style={styles.accessLabel}>Editor for</Text>
                        <Text style={styles.accessValue}>
                          {user.role === 'admin'
                            ? 'All centers'
                            : user.editorFor.length
                              ? user.editorFor.map(centerName).join(', ')
                              : 'None'}
                        </Text>
                        <Text style={[styles.accessLabel, styles.associatedLabel]}>Associated centers</Text>
                        <Text style={styles.accessValue}>
                          {user.role === 'admin'
                            ? 'All centers'
                            : user.centerIds.length
                              ? user.centerIds.map(centerName).join(', ')
                              : 'None'}
                        </Text>
                      </>
                    )}
                  </View>

                  {user.role === 'admin' ? (
                    <Pressable accessibilityRole="button" onPress={openCenterManagement} style={styles.manageCentersButton}>
                      <Building2 color={colors.forest} size={17} />
                      <View style={styles.manageCentersCopy}>
                        <Text style={styles.manageCentersTitle}>Manage centers</Text>
                        <Text style={styles.manageCentersSubtitle}>Centers and editor access</Text>
                      </View>
                      <ArrowRight color={colors.muted} size={16} />
                    </Pressable>
                  ) : null}

                  {isFeedbackOpen ? (
                    <View style={styles.feedbackBox} onLayout={(event) => scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true })}>
                      <View style={styles.feedbackHeader}>
                        <View style={styles.sectionTitleRowInline}>
                          <MessageSquare color={colors.forest} size={17} />
                          <Text style={styles.manageCentersTitle}>Send feedback</Text>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel="Close feedback form" hitSlop={10} onPress={() => setIsFeedbackOpen(false)}>
                          <X color={colors.muted} size={20} />
                        </Pressable>
                      </View>
                      <FeedbackForm context={`Signed-in ${user.role}`} initialEmail={user.email} />
                    </View>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => setIsFeedbackOpen(true)} style={styles.manageCentersButton}>
                      <MessageSquare color={colors.forest} size={17} />
                      <View style={styles.manageCentersCopy}>
                        <Text style={styles.manageCentersTitle}>Send feedback</Text>
                        <Text style={styles.manageCentersSubtitle}>Share a suggestion or report a problem</Text>
                      </View>
                      <ArrowRight color={colors.muted} size={16} />
                    </Pressable>
                  )}

                  <Pressable accessibilityRole="button" disabled={isSigningOut || isLiveSessionLoading} onPress={() => void handleSignOut()} style={styles.signOutButton}>
                    {isSigningOut || isLiveSessionLoading ? <ActivityIndicator color={colors.error} /> : <LogOut color={colors.error} size={17} />}
                    <Text style={styles.signOutLabel}>{isLiveSessionLoading ? 'Preparing sign out…' : 'Sign out'}</Text>
                  </Pressable>
                  {logoutError ? <Text accessibilityRole="alert" style={styles.errorText}>{logoutError}</Text> : null}
                </>
              ) : (
                <>
                  <View style={styles.signedOutCard}>
                    <View style={styles.signedOutIcon}><CircleUserRound color={colors.forest} size={25} strokeWidth={1.7} /></View>
                    <Text style={styles.signedOutTitle}>Signed out</Text>
                    <Text style={styles.signedOutBody}>Songs and public presentations are available without an account. Sign in to see your center’s singers, pitches, and access status.</Text>
                  </View>
                  <View onLayout={(event) => { signInOffsetY.current = event.nativeEvent.layout.y; }}>
                  <OtpSignInPanel
                    onFormLayout={(y) => scrollRef.current?.scrollTo({ y: Math.max(0, signInOffsetY.current + y - 12), animated: true })}
                    description=""
                    onSignedIn={(signedInUser) => {
                      setUser(signedInUser);
                      setLogoutError(null);
                    }}
                  />
                  </View>
                </>
              )}
            </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Animated.View>
      </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  profileButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#426756', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  buttonPressed: { opacity: 0.76 },
  onlineDot: { position: 'absolute', right: 1, bottom: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#78B68E', borderWidth: 1.5, borderColor: colors.forest },
  modalSafeAreaProvider: { flex: 1 },
  modalRoot: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(16, 29, 23, 0.42)' },
  backdrop: { ...StyleSheet.absoluteFill },
  drawer: { height: '100%', maxWidth: 420, backgroundColor: colors.paper, shadowColor: '#000000', shadowOffset: { width: -6, height: 0 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 14 },
  safeArea: { flex: 1 },
  drawerHeader: { minHeight: 48, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  drawerTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 22 },
  drawerScroll: { flex: 1 },
  drawerContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#426756' },
  identityCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, alignItems: 'center', padding: 20 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  avatarText: { color: colors.forest, fontFamily: 'Georgia', fontSize: 25 },
  userName: { color: colors.ink, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  userEmail: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
  statusBadge: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.sage, borderRadius: 14, paddingHorizontal: 11, marginTop: 12 },
  statusText: { color: colors.forest, fontSize: 11, fontWeight: '600' },
  section: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 15, marginTop: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  statusLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  statusLabel: { color: colors.muted, fontSize: 12 },
  statusValue: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  accessLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  accessValue: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  associatedLabel: { marginTop: 12 },
  centerLoader: { paddingVertical: 12 },
  signOutButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E7C9C2', borderRadius: 8, marginTop: 16 },
  signOutLabel: { color: colors.error, fontSize: 13, fontWeight: '600' },
  errorText: { color: colors.error, fontSize: 12, textAlign: 'center', marginTop: 11 },
  manageCentersButton: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginTop: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface },
  feedbackBox: { marginTop: 14, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface },
  feedbackHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitleRowInline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  manageCentersCopy: { flex: 1 },
  manageCentersTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  manageCentersSubtitle: { color: colors.muted, fontSize: 10, marginTop: 4 },
  signedOutCard: { alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 20 },
  signedOutIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  signedOutTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 17 },
  signedOutBody: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
});
