'use client';

import { createContext, useContext } from 'react';

/**
 * Turns analytics off for an entire subtree.
 *
 * The admin draft preview renders the real week page body, so without this
 * every proofread of a draft fires the same events readers fire, polluting the
 * baseline the live site is measured against. Threading a prop to each tracker
 * instead was tried and rejected: the props default to enabled, so any tracker
 * whose call site forgets one fails OPEN into pollution with nothing to catch
 * it. A trigger that was missed exactly that way is why this is a context.
 *
 * Default true so the public pages, which never render a provider, are
 * unaffected. Any new tracking component should read this rather than accept a
 * prop for it.
 */
const TrackingEnabledContext = createContext(true);

export function TrackingScope({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <TrackingEnabledContext.Provider value={enabled}>
      {children}
    </TrackingEnabledContext.Provider>
  );
}

export const useTrackingEnabled = () => useContext(TrackingEnabledContext);
