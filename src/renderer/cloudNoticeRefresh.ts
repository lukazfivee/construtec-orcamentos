// Na web, o sino acompanha o uso da interface sem acordar o banco por uma aba esquecida.
const ACTIVE_REFRESH_MS = 120_000;
const FOCUS_DEDUPE_MS = 2_000;

export function startCloudNoticeRefresh(
  page: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  windowEvents: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  refresh: () => void,
  now = () => performance.now(),
) {
  let lastRefresh = -Infinity;
  const update = (minInterval: number) => {
    if (page.hidden) return;
    const time = now();
    if (time - lastRefresh < minInterval) return;
    lastRefresh = time;
    refresh();
  };
  const onReturn = () => update(FOCUS_DEDUPE_MS);
  const onInteraction = () => update(ACTIVE_REFRESH_MS);
  page.addEventListener('visibilitychange', onReturn);
  windowEvents.addEventListener('focus', onReturn);
  page.addEventListener('pointerdown', onInteraction, { passive: true });
  page.addEventListener('keydown', onInteraction);
  onReturn();
  return () => {
    page.removeEventListener('visibilitychange', onReturn);
    windowEvents.removeEventListener('focus', onReturn);
    page.removeEventListener('pointerdown', onInteraction);
    page.removeEventListener('keydown', onInteraction);
  };
}
