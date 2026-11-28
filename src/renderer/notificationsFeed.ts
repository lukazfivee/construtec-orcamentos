// Avisos da Suite no computador: a mesma central do celular (public/m/screen-avisos.js). Os avisos ficam no Worker do Centro e o
// servidor do Orcamentos repassa com a sessao do usuario (GET /api/notifications, POST /api/notifications/read).
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, isCloudRuntime } from './api';
import { startCloudNoticeRefresh } from './cloudNoticeRefresh';

export type SuiteNotice = { id: string; type: string; app: string; title: string; body: string; link: string | null; createdAt: string; read: boolean };
type Feed = { items?: SuiteNotice[]; unread?: number };

export const noticesApi = {
  list: (limit = 50) => apiRequest<Feed>(`/api/notifications?limit=${limit}`),
  read: (body: { all: true } | { ids: string[] }) => apiRequest<unknown>('/api/notifications/read', { method: 'POST', body: JSON.stringify(body) }),
};

// Rotulo do sino igual ao do celular: "Notificações, 2 novas".
export const bellLabel = (unread: number) => `Notificações${unread ? `, ${unread} ${unread === 1 ? 'nova' : 'novas'}` : ''}`;
export const bellCount = (unread: number) => (unread > 99 ? '99+' : String(unread));

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
// Hoje, Ontem e Anteriores, como no celular.
export const noticeGroup = (iso: string, now = new Date()) => {
  if (dayKey(iso) === now.toLocaleDateString('en-CA')) return 'Hoje';
  if (dayKey(iso) === new Date(now.getTime() - 86400000).toLocaleDateString('en-CA')) return 'Ontem';
  return 'Anteriores';
};
export const noticeHour = (iso: string) => new Date(iso).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Na nuvem, sem consultas periódicas quando ninguém está usando a interface.
export function useNoticeCount() {
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(() => {
    void noticesApi.list(1).then((feed) => setUnread(Number(feed.unread) || 0)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (isCloudRuntime()) return startCloudNoticeRefresh(document, window, refresh);
    refresh();
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, 120000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer); };
  }, [refresh]);
  return { unread, setUnread, refresh };
}
