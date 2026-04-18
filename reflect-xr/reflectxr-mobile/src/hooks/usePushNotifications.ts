/**
 * usePushNotifications — wires push permissions + the tap-to-deep-link
 * behavior into the authenticated shell of the app.
 *
 * Mounted inside NavigationContainer (see AppNavigator) so `useNavigation`
 * resolves the top-level nav ref. Only does real work when the user is
 * authenticated — before login, we don't have a JWT to send the token
 * with, and the prompt would be confusing out of context.
 *
 * Tap flow: when the backend finishes a retry job, it sends a push with
 * `data = { jobId, conceptId }`. Tapping it fires the response listener
 * below and we navigate into the Response screen with the jobId so the
 * screen can poll /generate/status/{jobId} and show the finished images.
 * We deliberately bypass the prompt/style inputs — they were already
 * baked into the job on the backend side, so the Response screen just
 * hydrates from the server's record.
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from './useAuth';
import { registerForPushNotifications } from '../services/notificationService';

export function usePushNotifications() {
  const navigation = useNavigation() as any;
  const { isAuthenticated } = useAuth();
  // Guard: register once per authenticated session so we don't hammer
  // the permission dialog or the backend on every re-render.
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // User signed out — let the next sign-in re-register.
      hasRegistered.current = false;
      return;
    }
    if (hasRegistered.current) return;
    hasRegistered.current = true;
    // Fire-and-forget; errors are logged inside the service.
    registerForPushNotifications();
  }, [isAuthenticated]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          jobId?: string;
          conceptId?: string;
          kind?: string;
        };
        if (!data?.jobId) return;

        // Deep-link into the Response screen inside the Create stack.
        // We pass minimal params — the screen reads the images off the
        // backend via the jobId. prompt/style/concept are populated
        // with placeholders the screen treats as unused when jobId is
        // present (it skips the initial generate call).
        try {
          navigation.navigate('Main', {
            screen: 'Create',
            params: {
              screen: 'Response',
              params: {
                jobId: data.jobId,
                // The screen ignores these when jobId is set but the
                // route type still requires them; empty strings are
                // safer than undefined against the type definition.
                prompt: '',
                style: '',
                concept: { id: data.conceptId ?? '' } as any,
              },
            },
          });
        } catch (err) {
          // Navigation can throw if the user is signed out or the stack
          // hasn't mounted yet. Not fatal — they'll find the job in the
          // app next time they open it.
          console.warn('push tap: navigate failed:', err);
        }
      },
    );

    return () => sub.remove();
  }, [navigation]);
}
