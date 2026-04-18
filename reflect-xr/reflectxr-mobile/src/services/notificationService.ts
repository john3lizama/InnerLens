/**
 * notificationService — thin wrapper around expo-notifications for push
 * registration + foreground handling.
 *
 * WHAT WE DO HERE (and WHY in each case):
 * - `setupForegroundHandler()` — runs at module load from App.tsx. Without
 *   this, notifications arriving while the app is in the foreground are
 *   silently dropped. We want the banner to show so the user sees "Your
 *   image is ready" even if they're still looking at the "taking longer"
 *   orb.
 * - `registerForPushNotifications()` — asks the OS for notif permission,
 *   fetches the Expo push token, posts it to the backend. Idempotent —
 *   safe to call on every launch; backend upserts by token.
 * - `revokeCurrentPushToken()` — called on explicit logout so the server
 *   stops targeting this device for the signed-out user.
 *
 * The `projectId` passed to `getExpoPushTokenAsync` is the EAS project
 * ID. If it's not configured yet, we skip registration with a console
 * warning rather than crash — push simply won't work until `eas init`
 * has populated `expo.extra.eas.projectId` in app.json.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import * as generateService from './generateService';

// Keep this in module scope so `revokeCurrentPushToken` can find the
// token we registered on this launch without another round-trip to
// Expo's service.
let lastRegisteredToken: string | null = null;

/**
 * Installs the foreground handler. Must be called once at app startup
 * — before any notification can arrive — so we call it from App.tsx at
 * module-load (outside the React tree).
 */
export function setupForegroundHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // SDK 53+ split `shouldShowAlert` into banner/list flags. Both
      // true = legacy "show a banner and keep in Notification Center."
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Resolves the EAS projectId from any of the known locations expo SDKs
 * have exposed it over time. Returns `null` if we can't find one —
 * caller should bail cleanly rather than crash.
 */
function resolveProjectId(): string | null {
  const fromExpoConfig =
    // @ts-ignore — eas.projectId isn't in the core typings but is the
    // canonical location since SDK 48
    Constants.expoConfig?.extra?.eas?.projectId;
  const fromEasConfig =
    // @ts-ignore — legacy fallback
    (Constants as any).easConfig?.projectId;
  return fromExpoConfig ?? fromEasConfig ?? null;
}

/**
 * Permission prompt + push-token upsert. Returns the Expo token on
 * success, or `null` if the user declined or the device can't receive
 * notifications (simulators, missing projectId).
 *
 * Safe to call repeatedly — the OS only prompts once, the backend
 * dedupes on the token string.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Physical device required for push — iOS simulator won't return a
  // real Expo token and Android emulators without Google Play services
  // will fail silently. `isDevice` is our bail-out.
  if (!Device.isDevice) {
    console.info('push: skipped — not a physical device');
    return null;
  }

  // Step 1 — check / request OS permission.
  //
  // We cast the response to a minimal shape with just the boolean
  // we use (`granted`). The full `NotificationPermissionsStatus`
  // inherits its fields from `expo-modules-core.PermissionResponse`,
  // which in this SDK 55 setup is only hoisted under `expo/node_modules`
  // and tsc doesn't resolve the inherited members through that path.
  // `granted` has been a stable field on the runtime return since
  // expo-permissions, so the cast is safe.
  type PermissionLike = { granted: boolean };
  let permission = (await Notifications.getPermissionsAsync()) as unknown as PermissionLike;
  if (!permission.granted) {
    permission = (await Notifications.requestPermissionsAsync()) as unknown as PermissionLike;
  }
  if (!permission.granted) {
    console.info('push: permission not granted');
    return null;
  }

  // Android: set up a default channel so our notifications aren't
  // routed into the "Miscellaneous" bucket with no vibration. iOS
  // handles this at the OS level.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#6C63FF',
    });
  }

  // Step 2 — fetch Expo push token
  const projectId = resolveProjectId();
  if (!projectId) {
    console.warn(
      'push: no EAS projectId configured (expo.extra.eas.projectId). ' +
        'Run `eas init` to enable push notifications.',
    );
    return null;
  }

  let expoToken: string;
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    expoToken = tokenResponse.data;
  } catch (err) {
    console.warn('push: failed to obtain Expo token:', err);
    return null;
  }

  // Step 3 — tell the backend
  try {
    await generateService.registerPushToken(
      expoToken,
      Platform.OS === 'ios' ? 'ios' : 'android',
    );
    lastRegisteredToken = expoToken;
    return expoToken;
  } catch (err) {
    console.warn('push: backend registration failed:', err);
    return null;
  }
}

/**
 * Soft-revoke the current device's token on the backend. Called by
 * AuthContext.logout so a signed-out device stops receiving the next
 * user's pushes. Best-effort — if the revoke fails, the backend's
 * DeviceNotRegistered handling is the safety net.
 */
export async function revokeCurrentPushToken(): Promise<void> {
  if (!lastRegisteredToken) return;
  try {
    await generateService.revokePushToken(lastRegisteredToken);
  } catch (err) {
    console.warn('push: revoke failed (will rely on server sweep):', err);
  } finally {
    lastRegisteredToken = null;
  }
}
