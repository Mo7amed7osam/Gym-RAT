import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** "Now" for date-bucketed screens, refreshed whenever the screen regains focus (not on every render). */
export function useFocusNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );
  return now;
}
