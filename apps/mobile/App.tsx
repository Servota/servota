/* apps/mobile/App.tsx */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
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

// notifications helper
import { initNotifications, registerPushToken } from './src/lib/notifications';
import * as Notifications from 'expo-notifications';

type Screen = 'home' | 'memberships' | 'roster' | 'unavailability' | 'eventDetails';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth bootstrap
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.warn(error);
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    // log current notification permission status
    Notifications.getPermissionsAsync().then((p) => {
      console.log('🔔 Current notification permission status:', p);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('👤 auth state change:', _event, Boolean(newSession));
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Notifications bootstrap
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
    console.log('⎋ signOut pressed');
    const { error } = await supabase.auth.signOut();
    console.log('⎋ signOut result:', { error });
    if (error) Alert.alert('Sign out failed', error.message);
  };

  const back = () => {
    if (screen === 'eventDetails') setScreen('roster');
    else setScreen('home');
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 6, marginBottom: 8 }}>
        {screen !== 'home' ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <Button title="‹ Back" onPress={back} />
            {/* no top-right sign out */}
            <View style={{ width: 68 }} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', marginBottom: 2 }}>
            {/* Text-only brand (no blue cross) */}
            <Text style={styles.appBrand}>Servota</Text>
          </View>
        )}
      </View>

      {/* Screens */}
      {screen === 'home' && (
        <View style={{ flex: 1, paddingHorizontal: 20, gap: 12 }}>
          {/* Welcome under brand */}
          <View style={{ alignItems: 'flex-start', marginTop: 2, marginBottom: 6 }}>
            <Text style={styles.muted}>
              Welcome,{'\n'}
              <Text style={{ fontWeight: '600', color: '#111' }}>{email}</Text>
            </Text>
          </View>

          {/* Banners */}
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

          {/* Big raised Logout at bottom */}
          <Pressable onPress={handleSignOut} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
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

function HomeCard({ image, label, onPress }: { image: any; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.cardBtn}>
      <Image source={image} style={styles.cardIconImg} resizeMode="contain" />
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
    console.log('⎋ signIn result:', { hasSession: Boolean(data?.session), error });
    if (error) Alert.alert('Sign in failed', error.message);
  };

  const signUp = async () => {
    if (!email || !password) return Alert.alert('Enter email and password');
    setWorking(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setWorking(false);
    console.log('✚ signUp result:', { hasUser: Boolean(data?.user), error });
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
            <Button title="Sign in" onPress={signIn} />
          </View>
          <View style={styles.spacer} />
          <View style={styles.flex}>
            <Button title="Sign up" onPress={signUp} />
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
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  container: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: 20, gap: 12 },

  // Branding
  appBrand: { fontSize: 28, fontWeight: '800', color: '#222' },

  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 8 },
  h1: { fontSize: 18, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  spacer: { width: 12 },
  muted: { color: '#666' },
  mutedSmall: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 16 },

  // Home cards
  cardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ececec',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardIconImg: { width: 22, height: 22, opacity: 0.9 },
  cardLabel: { fontSize: 18, fontWeight: '700', color: '#222' },

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
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryText: { color: '#111', fontWeight: '800' },

  // Logout button
  logoutBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
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
