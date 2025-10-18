/* apps/mobile/src/features/notifications/BellButton.tsx */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { supabase } from '../../lib/supabase';
import Svg, { Path } from 'react-native-svg';

export default function BellButton({ onPress }: { onPress: () => void }) {
  const [count, setCount] = useState<number>(0);

  const loadCount = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any).rpc('unread_notification_count');
      if (!error && typeof data === 'number') setCount(data);
    } catch (e) {
      console.warn('load unread count failed', e);
    }
  }, []);

  // Poll every 30s + refresh when app foregrounds
  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000);
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') loadCount();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [loadCount]);

  return (
    <Pressable onPress={onPress} style={styles.wrap} android_ripple={{ color: '#e5e7eb' }}>
      <View style={styles.button}>
        <View style={styles.iconWrap}>
          <Svg
            width={26}
            height={26}
            viewBox="0 0 24 24"
            stroke="#111"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
            <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </Svg>
        </View>

        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Keeps the bell vertically centered within your ~96px header bar
  wrap: {
    position: 'relative',
    height: 96,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },

  // Rounded-square button container (like the reference image)
  button: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tight box around the 26×26 bell so it sits centered inside the square
  iconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Badge anchored to the square’s corner
  badge: {
    position: 'absolute',
    top: -6,
    right: -6, // switch to left: -6 for top-left
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2, // crisp ring so it looks “cut out”
    borderColor: '#fff',
  },

  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
