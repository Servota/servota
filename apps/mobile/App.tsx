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
  ScrollView,
} from 'react-native';
import { supabase } from './src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Switchers from './src/features/switchers/Switchers';
import { CurrentProvider } from './src/context/CurrentContext';

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
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading…</Text>
        </View>
      ) : session ? (
        <AuthedView
          email={session.user.email ?? ''}
          onSignOut={async () => {
            const { error } = await supabase.auth.signOut();
            if (error) Alert.alert('Sign out failed', error.message);
          }}
        />
      ) : (
        <SignInView />
      )}
    </CurrentProvider>
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

function AuthedView({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.title}>You're signed in</Text>
      <Text style={styles.subtitle}>{email}</Text>
      <Button title="Sign out" onPress={onSignOut} />
      <View style={{ height: 8 }} />
      <Switchers />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  container: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  spacer: { width: 12 },
  muted: { color: '#666' },
  mutedSmall: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 16 },
});
