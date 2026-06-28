import { useEffect, useRef } from 'react';

type Handler = (data: unknown) => void;

/** يشترك في قناة SSE ويستدعي المعالجات حسب نوع الحدث */
export function useSSE(handlers: Record<string, Handler>): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const es = new EventSource('/api/stream', { withCredentials: true });
    const entries = Object.keys(ref.current);
    const listeners: Record<string, EventListener> = {};
    for (const ev of entries) {
      const l: EventListener = (e) => {
        try {
          ref.current[ev]?.(JSON.parse((e as MessageEvent).data));
        } catch {
          /* تجاهل */
        }
      };
      listeners[ev] = l;
      es.addEventListener(ev, l);
    }
    return () => {
      for (const ev of entries) es.removeEventListener(ev, listeners[ev]);
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
