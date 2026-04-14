/**
 * MindMateContext — Tracks unread MindMate messages.
 *
 * When MindMate replies while the user is on another tab,
 * the MindMate tab icon switches to `message.badge` (SF Symbol).
 * Cleared when the user navigates to the MindMate tab.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface MindMateContextValue {
  hasUnread: boolean;
  markUnread: () => void;
  clearUnread: () => void;
}

const MindMateContext = createContext<MindMateContextValue>({
  hasUnread: false,
  markUnread: () => {},
  clearUnread: () => {},
});

export function MindMateProvider({ children }: { children: React.ReactNode }) {
  const [hasUnread, setHasUnread] = useState(false);

  const markUnread = useCallback(() => setHasUnread(true), []);
  const clearUnread = useCallback(() => setHasUnread(false), []);

  return (
    <MindMateContext.Provider value={{ hasUnread, markUnread, clearUnread }}>
      {children}
    </MindMateContext.Provider>
  );
}

export function useMindMate() {
  return useContext(MindMateContext);
}
