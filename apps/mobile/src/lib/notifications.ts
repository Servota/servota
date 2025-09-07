// apps/mobile/src/lib/notifications.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

type InitResult = {
  token?: string;
  granted: boolean;
  unsubscribe?: () => void;
};

// Coerce to the SDK behavior type (some SDK versions expect banner/list flags too)
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      // @ts-ignore satisfy wider behavior in some SDK/typing combos
      shouldShowBanner: true,
      // @ts-ignore satisfy wider behavior in some SDK/typing combos
      shouldShowList: true,
    }) as unknown as Notifications.NotificationBehavior,
});

/**
 * Ask for permissions (if not already granted).
 */
export async function ensureNotificationPermissions(): Promise<{
  granted: boolean;
  status: Notifications.PermissionStatus;
}> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) {
    return { granted: true, status: settings.status };
  }
  const request = await Notifications.requestPermissionsAsync();
  return { granted: request.granted, status: request.status };
}

/**
 * Register (or refresh) the Expo push token and upsert it via the DB RPC.
 * Returns the token if successful.
 */
export async function registerPushToken(): Promise<string | undefined> {
  try {
    const { granted } = await ensureNotificationPermissions();
    if (!granted) return undefined;

    // Expo SDK 53 requires a projectId (we supplied it in app.json extra.eas.projectId)
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    console.log('🔔 Expo push token response:', tokenResponse);
    const token = tokenResponse.data;

    const platform = Platform.OS; // 'ios' | 'android' | 'web'
    const device_info = `os=${Platform.OS}; version=${String(Platform.Version)}`;

    // IMPORTANT: match the DB function parameter names exactly
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: platform,
      p_device_info: device_info,
    });

    if (error) {
      console.warn('register_push_token RPC error:', error.message);
      return undefined;
    }

    return token;
  } catch (err: unknown) {
    console.warn('registerPushToken error:', err);
    return undefined;
  }
}

/**
 * Initialise notifications:
 *  - registers token
 *  - attaches listeners for foreground receipt & user tap
 * Returns the token and an unsubscribe to remove listeners.
 */
export async function initNotifications(): Promise<InitResult> {
  const token = await registerPushToken();

  const receivedSub = Notifications.addNotificationReceivedListener(() => {
    // TODO: show in-app toast/banner later
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    // Later: navigate based on response.notification.request.content.data
    console.log('Notification tapped:', response?.notification?.request?.content?.data);
  });

  const unsubscribe = () => {
    receivedSub.remove();
    responseSub.remove();
  };

  return {
    token,
    granted: Boolean(token),
    unsubscribe,
  };
}
