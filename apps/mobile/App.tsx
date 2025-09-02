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
} from 'react-native';
import { supabase } from './src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { CurrentProvider, useCurrent } from './src/context/CurrentContext';
import MyMemberships from './src/features/memberships/MyMemberships';
import MyRoster from './src/features/roster/MyRoster';

type Screen = 'home' | 'memberships' | 'roster' | 'unavailability';

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
  const { accountName, teamName } = useCurrent();

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
            <Button title="◀ Back" onPress={() => setScreen('home')} />
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
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Button title="My Memberships" onPress={() => setScreen('memberships')} />
          <Button title="My Roster" onPress={() => setScreen('roster')} />
          <Button title="My Unavailability" onPress={() => setScreen('unavailability')} />
          <Text style={[styles.mutedSmall, { marginTop: 8 }]}>
            Tip: select an Account/Team in “My Memberships” to filter your roster.
          </Text>
        </View>
      )}

      {screen === 'memberships' && <MyMemberships />}

      {screen === 'roster' && <MyRoster />}

      {screen === 'unavailability' && (
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={styles.h1}>My Unavailability</Text>
          <Text style={styles.muted}>
            Placeholder screen. Next we’ll show your future unavailability (by selected Account) and
            let you add/remove entries.
          </Text>
        </View>
      )}
    </View>
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
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 8 },
  h1: { fontSize: 18, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  spacer: { width: 12 },
  muted: { color: '#666' },
  mutedSmall: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 16 },
});
