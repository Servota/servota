/* apps/mobile/App.tsx */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  Pressable,
  AppState,
  AppStateStatus,
  Image,
} from 'react-native';
import { supabase } from './src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { CurrentProvider } from './src/context/CurrentContext';
import MyMemberships from './src/features/memberships/MyMemberships';
import MyRoster from './src/features/roster/MyRoster';
import MyUnavailability from './src/features/unavailability/MyUnavailability';
import EventDetails, { type SelectedEvent } from './src/features/roster/EventDetails';
import HomeAlerts from './src/features/home/HomeAlerts';
import HomeSwapRequests from './src/features/home/HomeSwapRequests';

import { initNotifications, registerPushToken } from './src/lib/notifications';
import * as Notifications from 'expo-notifications';

type Screen = 'home' | 'memberships' | 'roster' | 'unavailability' | 'eventDetails';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.warn(error);
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    Notifications.getPermissionsAsync().then((p) => {
      console.log('[notif] Current permission status:', p);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('[auth] state change:', _event, Boolean(newSession));
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let unsubNotif: (() => void) | undefined;
    let mounted = true;

    (async () => {
      const { unsubscribe } = await initNotifications();
      if (!mounted) {
        unsubscribe?.();
        return;
      }
      unsubNotif = unsubscribe;
    })();

    const handleAppState = async (state: AppStateStatus) => {
      if (state === 'active') {
        await registerPushToken();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      mounted = false;
      unsubNotif?.();
      appStateSub.remove();
    };
  }, [session]);

  return (
    <CurrentProvider>
      <SafeAreaView
        style={[
          styles.safe,
          { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0 },
        ]}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : session ? (
          <AuthedApp email={session.user.email ?? ''} />
        ) : (
          <SignInView />
        )}
      </SafeAreaView>
    </CurrentProvider>
  );
}

function AuthedApp({ email }: { email: string }) {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);

  const handleSignOut = async () => {
    console.log('[auth] signOut pressed');
    const { error } = await supabase.auth.signOut();
    console.log('[auth] signOut result:', { error });
    if (error) Alert.alert('Sign out failed', error.message);
  };

  const back = () => {
    if (screen === 'eventDetails') setScreen('roster');
    else setScreen('home');
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header / Brand */}
      <View style={styles.brandWrap}>
        {/* Swap this Text for <Image source={require('./assets/brand/servota-logo.png')} .../> in Step 2 */}
        <Text style={styles.brandWord}>SERVOTA</Text>
        <Text style={styles.brandEmail}>{email}</Text>
      </View>

      {/* Screens */}
      {screen === 'home' && (
        <View style={styles.homeWrap}>
          {/* Optional banners (kept, but visually secondary) */}
          <HomeAlerts />
          <HomeSwapRequests />

          {/* Cards */}
          <HomeCard
            image={require('./assets/home/memberships.png')}
            label="Memberships"
            onPress={() => setScreen('memberships')}
          />
          <HomeCard
            image={require('./assets/home/roster.png')}
            label="Roster"
            onPress={() => setScreen('roster')}
          />
          <HomeCard
            image={require('./assets/home/unavailability.png')}
            label="Unavailability"
            onPress={() => setScreen('unavailability')}
          />

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Logout */}
          <Pressable
            onPress={handleSignOut}
            style={styles.logoutBtn}
            android_ripple={{ color: '#e5e7eb' }}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      )}

      {screen !== 'home' && (
        <View style={styles.subHeader}>
          <BackButton onPress={back} />
        </View>
      )}

      {screen === 'memberships' && <MyMemberships />}

      {screen === 'roster' && (
        <MyRoster
          onOpenDetails={(a) => {
            setSelectedEvent({
              event_id: a.event_id,
              template_id: a.template_id,
              account_id: a.account_id,
              team_id: a.team_id,
              label: a.label,
              starts_at: a.starts_at,
              ends_at: a.ends_at,
              account_name: a.account_name,
              team_name: a.team_name,
            });
            setScreen('eventDetails');
          }}
        />
      )}

      {screen === 'eventDetails' && selectedEvent && (
        <EventDetails selected={selectedEvent} setSelected={setSelectedEvent} />
      )}

      {screen === 'unavailability' && <MyUnavailability />}
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backBtn} android_ripple={{ color: '#e5e7eb' }}>
      <Text style={styles.backIcon}>←</Text>
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

function HomeCard({ image, label, onPress }: { image: any; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.cardBtn} android_ripple={{ color: '#e5e7eb' }}>
      <View style={styles.iconCircle}>
        <Image source={image} style={styles.cardIconImg} resizeMode="contain" />
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
    </Pressable>
  );
}

function SignInView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);

  const signIn = async () => {
    if (!email || !password) return Alert.alert('Enter email and password');
    setWorking(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setWorking(false);
    console.log('[auth] signIn result:', { hasSession: Boolean(data?.session), error });
    if (error) Alert.alert('Sign in failed', error.message);
  };

  const signUp = async () => {
    if (!email || !password) return Alert.alert('Enter email and password');
    setWorking(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setWorking(false);
    console.log('[auth] signUp result:', { hasUser: Boolean(data?.user), error });
    if (error) Alert.alert('Sign up failed', error.message);
    else Alert.alert('Check your email', 'We sent you a confirmation link.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Servota</Text>
      <Text style={styles.subtitle}>Sign in</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      {working ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Pressable
              onPress={signIn}
              style={styles.primaryBtn}
              android_ripple={{ color: '#2563eb' }}
            >
              <Text style={styles.primaryText}>Sign in</Text>
            </Pressable>
          </View>
          <View style={styles.spacer} />
          <View style={styles.flex}>
            <Pressable
              onPress={signUp}
              style={styles.secondaryBtn}
              android_ripple={{ color: '#e5e7eb' }}
            >
              <Text style={styles.secondaryText}>Sign up</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.mutedSmall}>
        Project:{'\n'}
        {process.env.EXPO_PUBLIC_SUPABASE_URL}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafafa' }, // soft off-white background
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  container: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: 20, gap: 12 },

  // Brand area
  brandWrap: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 8,
    gap: 6,
  },
  brandWord: { fontSize: 28, fontWeight: '800', letterSpacing: 1, color: '#111' },
  brandEmail: { fontSize: 16, color: '#6b7280' },

  homeWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 14 },

  // Sub header for non-home screens
  subHeader: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },

  // Inputs / text
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 8 },
  h1: { fontSize: 18, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  spacer: { width: 12 },
  muted: { color: '#6b7280' },
  mutedSmall: { color: '#6b7280', fontSize: 12, textAlign: 'center', marginTop: 16 },

  // Home cards
  cardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ececec',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconImg: { width: 26, height: 26, opacity: 0.9 },
  cardLabel: { fontSize: 22, fontWeight: '800', color: '#111' },

  // Event details etc
  card: {
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sub: { fontSize: 12, color: '#555', marginTop: 2 },
  meta: { fontSize: 13, color: '#444', marginTop: 6 },
  h2: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  rowMeta: { fontSize: 12, color: '#555' },
  mutedRow: { color: '#666' },

  // Buttons
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#111', fontWeight: '800' },

  // Back
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignSelf: 'flex-start',
  },
  backIcon: { fontSize: 16, color: '#111' },
  backText: { fontWeight: '700', color: '#111' },

  // Logout button
  logoutBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  logoutText: { fontWeight: '700', color: '#111', fontSize: 16 },
});
