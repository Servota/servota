// apps/mobile/App.tsx
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
} from 'react-native';
import { supabase } from './src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { CurrentProvider, useCurrent } from './src/context/CurrentContext';
import MyMemberships from './src/features/memberships/MyMemberships';
import MyRoster from './src/features/roster/MyRoster';
import MyUnavailability from './src/features/unavailability/MyUnavailability';
import EventDetails, { type SelectedEvent } from './src/features/roster/EventDetails';
import HomeAlerts from './src/features/home/HomeAlerts';
import HomeSwapRequests from './src/features/home/HomeSwapRequests';

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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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
  const { accountName, teamName } = useCurrent();

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
            <Button title="◀ Back" onPress={back} />
            <Button
              title="Sign out"
              onPress={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) Alert.alert('Sign out failed', error.message);
              }}
            />
          </View>
        ) : (
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={styles.title}>Welcome</Text>
            <Button
              title="Sign out"
              onPress={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) Alert.alert('Sign out failed', error.message);
              }}
            />
          </View>
        )}
        <Text style={styles.subtitle}>
          {email}
          {accountName ? ` • ${accountName}` : ''}
          {teamName ? ` → ${teamName}` : ''}
        </Text>
      </View>

      {/* Screens */}
      {screen === 'home' && (
        <View style={{ flex: 1, paddingHorizontal: 20, gap: 12 }}>
          {/* Logo / brand */}
          <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 6 }}>
            <View style={styles.logoRow}>
              <View style={styles.logoMark}>
                <Text style={styles.logoPlus}>＋</Text>
              </View>
              <Text style={styles.logoText}>Servota</Text>
            </View>
            <Text style={[styles.muted, { marginTop: 8 }]}>
              Welcome,{'\n'}
              <Text style={{ fontWeight: '600', color: '#111' }}>{email}</Text>
            </Text>
          </View>

          {/* Alerts banner */}
          <HomeAlerts />
          <HomeSwapRequests />

          {/* Big action cards */}
          <HomeCard icon="👤" label="Memberships" onPress={() => setScreen('memberships')} />
          <HomeCard icon="👥" label="Roster" onPress={() => setScreen('roster')} />
          <HomeCard icon="📅" label="Unavailability" onPress={() => setScreen('unavailability')} />

          {/* Context hint */}
          <Text style={[styles.mutedSmall, { textAlign: 'center', marginTop: 6 }]}>
            {accountName ? `Selected: ${accountName}` : 'No account selected'}
            {teamName ? ` → ${teamName}` : ''}
          </Text>

          {/* Footer logout */}
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={async () => {
              const { error } = await supabase.auth.signOut();
              if (error) Alert.alert('Sign out failed', error.message);
            }}
            style={{ alignSelf: 'center', paddingVertical: 16 }}
          >
            <Text style={[styles.muted, { fontWeight: '600' }]}>Logout</Text>
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

function HomeCard({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.cardBtn}>
      <Text style={styles.cardIcon}>{icon}</Text>
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setWorking(false);
    if (error) Alert.alert('Sign in failed', error.message);
  };

  const signUp = async () => {
    if (!email || !password) return Alert.alert('Enter email and password');
    setWorking(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setWorking(false);
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
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlus: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: -1 },
  logoText: { fontSize: 28, fontWeight: '800', color: '#222' },

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
  cardIcon: { fontSize: 22 },
  cardLabel: { fontSize: 18, fontWeight: '700', color: '#222' },
});
