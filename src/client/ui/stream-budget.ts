import { createContext, useContext, useEffect, useId, useState } from 'react';
export const StreamBudgetContext = createContext(2);
const running = new Set<string>(),
  events = new EventTarget();
/** Two overview streams per browser; detail views suspend obscured previews separately. */
export function useStreamBudget(eligible: boolean, inline: boolean) {
  const limit = useContext(StreamBudgetContext);
  const id = useId(),
    [granted, setGranted] = useState(!inline);
  useEffect(() => {
    if (!inline) {
      setGranted(eligible);
      return;
    }
    if (!eligible) {
      setGranted(false);
      return;
    }
    const update = () => {
      if (running.has(id)) {
        setGranted(true);
        return;
      }
      if (running.size < limit) {
        running.add(id);
        setGranted(true);
        events.dispatchEvent(new Event('change'));
      } else setGranted(false);
    };
    events.addEventListener('change', update);
    update();
    return () => {
      events.removeEventListener('change', update);
      if (running.delete(id)) events.dispatchEvent(new Event('change'));
    };
  }, [eligible, inline, id, limit]);
  return granted;
}
