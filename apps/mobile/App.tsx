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
import Notifications from './src/features/notifications/Notifications';
import BellButton from './src/features/notifications/BellButton';

import { initNotifications, registerPushToken } from './src/lib/notifications';
import * as NotificationsSDK from 'expo-notifications';

type Screen =
  | 'home'
  | 'memberships'
  | 'roster'
  | 'unavailability'
  | 'eventDetails'
  | 'details'
  | 'notifications';
type AuthMode = 'signin' | 'signup';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.warn(error);
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    NotificationsSDK.getPermissionsAsync().then((p) => {
      console.log('[notif] Current notification status:', p);
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
          <AuthedApp />
        ) : authMode === 'signin' ? (
          <SignInView onSwitchMode={() => setAuthMode('signup')} />
        ) : (
          <SignUpView onSwitchMode={() => setAuthMode('signin')} />
        )}
      </SafeAreaView>
    </CurrentProvider>
  );
}

function AuthedApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);

  const handleSignOut = async () => {
    console.log('[auth] signOut pressed');
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Sign out failed', error.message);
  };

  const back = () => {
    if (screen === 'eventDetails') setScreen('roster');
    else setScreen('home');
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header / Brand + Bell */}
      <View style={styles.brandBar}>
        <Image source={require('./assets/brand/servota-logo.png')} style={styles.brandLogo} />
        <BellButton onPress={() => setScreen('notifications')} />
      </View>

      {/* Screens */}
      {screen === 'home' && (
        <View style={styles.homeWrap}>
          {/* Keep these for now; can be removed later if the pane replaces them */}
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
          <HomeCard
            image={require('./assets/home/mydetails.png')}
            label="My Details"
            onPress={() => setScreen('details')}
          />

          <View style={{ flex: 1 }} />

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

      {screen === 'notifications' && <Notifications />}

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

      {screen === 'details' && <MyDetails />}
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backBtn} android_ripple={{ color: '#e5e7eb' }}>
      <Text style={styles.backIcon}>{'<'}</Text>
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

function SignInView({ onSwitchMode }: { onSwitchMode: () => void }) {
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

  return (
    <View style={styles.container}>
      <Image source={require('./assets/brand/servota-logo.png')} style={styles.authLogo} />
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
        <>
          <Pressable
            onPress={signIn}
            style={styles.primaryBtn}
            android_ripple={{ color: '#2563eb' }}
          >
            <Text style={styles.primaryText}>Sign in</Text>
          </Pressable>

          <View style={{ height: 8 }} />

          <Pressable
            onPress={onSwitchMode}
            style={styles.secondaryBtn}
            android_ripple={{ color: '#e5e7eb' }}
          >
            <Text style={styles.secondaryText}>Create an account</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function SignUpView({ onSwitchMode }: { onSwitchMode: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [working, setWorking] = useState(false);

  const signUp = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();

    if (!fn || !ln || !em || !password || !confirm) {
      Alert.alert(
        'Missing info',
        'Please fill first name, last name, email, and both password fields.'
      );
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Please re-enter your password.');
      return;
    }

    try {
      setWorking(true);

      const { error } = await supabase.auth.signUp({
        email: em,
        password,
        options: { data: { first_name: fn, last_name: ln } },
      });

      if (error) {
        Alert.alert('Sign up failed', error.message);
        return;
      }

      Alert.alert(
        'Check your email',
        'We sent you a confirmation link. After confirming, return here to sign in.'
      );
      onSwitchMode();
    } finally {
      setWorking(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('./assets/brand/servota-logo.png')} style={styles.authLogo} />
      <Text style={styles.subtitle}>Create account</Text>

      <TextInput
        placeholder="First name"
        value={firstName}
        onChangeText={setFirstName}
        style={styles.input}
      />
      <TextInput
        placeholder="Last name"
        value={lastName}
        onChangeText={setLastName}
        style={styles.input}
      />
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
      <TextInput
        placeholder="Confirm password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        style={styles.input}
      />

      {working ? (
        <ActivityIndicator />
      ) : (
        <>
          <Pressable
            onPress={signUp}
            style={styles.primaryBtn}
            android_ripple={{ color: '#2563eb' }}
          >
            <Text style={styles.primaryText}>Sign up</Text>
          </Pressable>

          <View style={{ height: 8 }} />

          <Pressable
            onPress={onSwitchMode}
            style={styles.secondaryBtn}
            android_ripple={{ color: '#e5e7eb' }}
          >
            <Text style={styles.secondaryText}>Back to sign in</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function MyDetails() {
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // Load current user details
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        Alert.alert('Unable to load profile', error.message);
        setLoading(false);
        return;
      }
      const u = data.user;
      if (!u) {
        setLoading(false);
        return;
      }
      if (!mounted) return;
      setFirstName(String(u.user_metadata?.first_name ?? ''));
      setLastName(String(u.user_metadata?.last_name ?? ''));
      setEmail(String(u.email ?? ''));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveName = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      Alert.alert('Missing info', 'Please enter both first and last name.');
      return;
    }

    setSavingName(true);

    // 1) Update auth user metadata
    const { error: authErr } = await supabase.auth.updateUser({
      data: { first_name: fn, last_name: ln },
    });
    if (authErr) {
      setSavingName(false);
      Alert.alert('Update failed', authErr.message);
      return;
    }

    // 2) Mirror into public.profiles via upsert on user_id
    const { data: userData, error: getErr } = await supabase.auth.getUser();
    if (getErr || !userData.user) {
      setSavingName(false);
      Alert.alert('Update failed', getErr?.message ?? 'No auth user.');
      return;
    }

    const userId = userData.user.id;
    const full = `${fn} ${ln}`.trim();

    const { error: profErr } = await supabase.from('profiles').upsert(
      [
        {
          user_id: userId,
          first_name: fn,
          last_name: ln,
          full_name: full,
          display_name: full,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'user_id' }
    );

    setSavingName(false);

    if (profErr) {
      Alert.alert(
        'Saved to auth only',
        `Name saved to account, but profile failed: ${profErr.message}`
      );
      return;
    }

    Alert.alert('Saved', 'Your name has been updated.');
  };

  const changeEmail = async () => {
    const em = email.trim();
    if (!em) {
      Alert.alert('Missing email', 'Please enter a valid email.');
      return;
    }
    setChangingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: em });
    setChangingEmail(false);
    if (error) {
      Alert.alert('Email change failed', error.message);
      return;
    }
    Alert.alert(
      'Verify your new email',
      'We sent a confirmation link to the new address. Open it to complete the change.'
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingHorizontal: 16, paddingTop: 12 }]}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading your details…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 14 }}>
      <View style={styles.card}>
        <Text style={styles.h1}>My Details</Text>
        <Text style={styles.meta}>
          Update your name and email. Changing email will require you to confirm via a link we send
          to the new address.
        </Text>
      </View>

      {/* Name */}
      <View style={[styles.card, { gap: 10 }]}>
        <Text style={styles.h2}>Name</Text>
        <TextInput
          placeholder="First name"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
        />
        <TextInput
          placeholder="Last name"
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
        />
        <Pressable
          onPress={saveName}
          disabled={savingName}
          style={[styles.primaryBtn, savingName && { opacity: 0.6 }]}
          android_ripple={{ color: '#2563eb' }}
        >
          {savingName ? <ActivityIndicator /> : <Text style={styles.primaryText}>Save name</Text>}
        </Pressable>
      </View>

      {/* Email */}
      <View style={[styles.card, { gap: 10 }]}>
        <Text style={styles.h2}>Email</Text>
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <Pressable
          onPress={changeEmail}
          disabled={changingEmail}
          style={[styles.secondaryBtn, changingEmail && { opacity: 0.6 }]}
          android_ripple={{ color: '#e5e7eb' }}
        >
          {changingEmail ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.secondaryText}>Change email</Text>
          )}
        </Pressable>
        <Text style={[styles.meta, { marginTop: 4 }]}>
          You may be signed out after confirming the new email.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  container: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: 20, gap: 12 },

  brandBar: {
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  brandLogo: { width: 320, height: 96, resizeMode: 'contain' },
  authLogo: {
    width: 220,
    height: 70,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 12,
  },

  homeWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  subHeader: { paddingHorizontal: 16, paddingBottom: 6 },

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
  meta: { fontSize: 13, color: '#444', marginTop: 6 },
  h2: { fontSize: 16, fontWeight: '800', marginTop: 8 },

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

  backBtn: {
    marginTop: 10,
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

  logoutBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 32,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  logoutText: { fontWeight: '700', color: '#111', fontSize: 16 },
});

export {};
