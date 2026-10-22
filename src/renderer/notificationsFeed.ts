// Avisos da Suite no computador: a mesma central do celular (public/m/screen-avisos.js). Os avisos ficam no Worker do Centro e o
// servidor do Orcamentos repassa com a sessao do usuario (GET /api/notifications, POST /api/notifications/read).
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api';

export type SuiteNotice = { id: string; type: string; app: string; title: string; body: string; link: string | null; createdAt: string; read: boolean };
type Feed = { items?: SuiteNotice[]; unread?: number };

export const noticesApi = {
  list: (limit = 50) => apiRequest<Feed>(`/api/notifications?limit=${limit}`),
  read: (body: { all: true } | { ids: string[] }) => apiRequest<unknown>('/api/notifications/read', { method: 'POST', body: JSON.stringify(body) }),
};

// Rotulo do sino igual ao do celular: "Notificações, 2 novas".
export const bellLabel = (unread: number) => `Notificações${unread ? `, ${unread} ${unread === 1 ? 'nova' : 'novas'}` : ''}`;
export const bellCount = (unread: number) => (unread > 99 ? '99+' : String(unread));

const dayKey = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-CA');
};
// Hoje, Ontem e Anteriores, como no celular.
export const noticeGroup = (iso: string, now = new Date()) => {
  if (dayKey(iso) === now.toLocaleDateString('en-CA')) return 'Hoje';
  if (dayKey(iso) === new Date(now.getTime() - 86400000).toLocaleDateString('en-CA')) return 'Ontem';
  return 'Anteriores';
};
export const noticeHour = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Contador do sino: le ao abrir o app, ao voltar para a janela e a cada 2 minutos; sem central, o sino fica sem numero.
export function useNoticeCount() {
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(() => {
    void noticesApi.list(1).then((feed) => setUnread(Number(feed.unread) || 0)).catch(() => undefined);
  }, []);
  useEffect(() => {
    refresh();
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, 120000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer); };
  }, [refresh]);
  return { unread, setUnread, refresh };
}
