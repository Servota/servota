/* eslint-disable no-unused-vars */
// apps/mobile/src/context/CurrentContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Ctx = {
  accountId: string | null;
  accountName: string | null;
  teamId: string | null;
  teamName: string | null;
  setAccount: (id: string, name: string) => void;
  setTeam: (id: string, name: string) => void;
  clear: () => void;
  ready: boolean; // Async restored
};

const KEYS = {
  accountId: 'servota.accountId',
  accountName: 'servota.accountName',
  teamId: 'servota.teamId',
  teamName: 'servota.teamName',
};

const CurrentContext = createContext<Ctx | undefined>(undefined);

export function CurrentProvider({ children }: { children: React.ReactNode }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Load from storage once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [aId, aName, tId, tName] = await Promise.all([
          AsyncStorage.getItem(KEYS.accountId),
          AsyncStorage.getItem(KEYS.accountName),
          AsyncStorage.getItem(KEYS.teamId),
          AsyncStorage.getItem(KEYS.teamName),
        ]);
        if (!mounted) return;
        setAccountId(aId);
        setAccountName(aName);
        setTeamId(tId);
        setTeamName(tName);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setAccount = (id: string, name: string) => {
    const changed = accountId !== id; // only clear team if account actually changed
    setAccountId(id);
    setAccountName(name);
    AsyncStorage.multiSet([
      [KEYS.accountId, id],
      [KEYS.accountName, name],
    ]).catch(() => {});
    if (changed) {
      setTeamId(null);
      setTeamName(null);
      AsyncStorage.multiSet([
        [KEYS.teamId, ''],
        [KEYS.teamName, ''],
      ]).catch(() => {});
    }
  };

  const setTeam = (id: string, name: string) => {
    setTeamId(id || null);
    setTeamName(name || null);
    AsyncStorage.multiSet([
      [KEYS.teamId, id || ''],
      [KEYS.teamName, name || ''],
    ]).catch(() => {});
  };

  const clear = () => {
    setAccountId(null);
    setAccountName(null);
    setTeamId(null);
    setTeamName(null);
    AsyncStorage.multiRemove(Object.values(KEYS)).catch(() => {});
  };

  const value = useMemo<Ctx>(
    () => ({ accountId, accountName, teamId, teamName, setAccount, setTeam, clear, ready }),
    [accountId, accountName, teamId, teamName, setAccount, setTeam, clear, ready]
  );

  return <CurrentContext.Provider value={value}>{children}</CurrentContext.Provider>;
}

export function useCurrent() {
  const ctx = useContext(CurrentContext);
  if (!ctx) throw new Error('useCurrent must be used within CurrentProvider');
  return ctx;
}
