import { useEffect, useRef, useState } from 'react';
import { Bell, Check, RefreshCw } from './icons';
import { noticeGroup, noticeHour, noticesApi, type SuiteNotice } from './notificationsFeed';

interface NotificationsPopoverProps {
  onClose: () => void;
  /** Contador do sino: atualiza quando a pessoa marca como lido. */
  onUnreadChange: (unread: number) => void;
  /** Destino do aviso (orcamentos?proposta=... ou centro-custos?obra=...). */
  onFollow: (link: string) => void;
}

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; items: SuiteNotice[] };

// Notificacoes do computador: os mesmos avisos do celular (Proposta aprovada, Novo acesso a proposta, Conta a vencer...),
// por dia, com o ponto ciano nos novos e "Marcar todas como lidas".
export function NotificationsPopover({ onClose, onUnreadChange, onFollow }: NotificationsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (popoverRef.current && !popoverRef.current.contains(target) && !target.closest?.('[data-sino]')) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    setLoad({ state: 'loading' });
    noticesApi.list()
      .then((feed) => { if (!active) return; setLoad({ state: 'ready', items: feed.items ?? [] }); onUnreadChange(Number(feed.unread) || 0); })
      .catch(() => { if (active) setLoad({ state: 'error' }); });
    return () => { active = false; };
  }, [attempt, onUnreadChange]);

  const items = load.state === 'ready' ? load.items : [];
  const unread = items.filter((item) => !item.read).length;
  const groups = (['Hoje', 'Ontem', 'Anteriores'] as const).map((name) => [name, items.filter((item) => noticeGroup(item.createdAt) === name)] as const).filter(([, list]) => list.length);

  const markAll = async () => {
    const before = load;
    setLoad({ state: 'ready', items: items.map((item) => ({ ...item, read: true })) });
    onUnreadChange(0);
    await noticesApi.read({ all: true }).catch(() => { setLoad(before); onUnreadChange(unread); });
  };
  const open = async (notice: SuiteNotice) => {
    if (!notice.read) {
      setLoad({ state: 'ready', items: items.map((item) => (item.id === notice.id ? { ...item, read: true } : item)) });
      onUnreadChange(Math.max(0, unread - 1));
      await noticesApi.read({ ids: [notice.id] }).catch(() => {
        setLoad((current) => (current.state === 'ready' ? { state: 'ready', items: current.items.map((item) => (item.id === notice.id ? { ...item, read: false } : item)) } : current));
        onUnreadChange(unread);
      });
    }
    if (notice.link) { onClose(); onFollow(notice.link); }
  };

  return (
    <div className="notifications-popover pop" ref={popoverRef} role="dialog" aria-label="Notificações">
      <div className="notifications-header">
        <strong>Notificações</strong>
        {unread > 0 && (
          <button type="button" className="notifications-read-all" onClick={() => void markAll()}>
            <Check size={16} /> Marcar todas como lidas
          </button>
        )}
      </div>

      {load.state === 'loading' && (
        <div className="notifications-skeleton" role="status" aria-label="Carregando as notificações"><i /><i /><i /></div>
      )}
      {load.state === 'error' && (
        <div className="notifications-empty">
          <Bell size={24} />
          <b>Não deu para carregar as notificações</b>
          <span>A central de avisos da Suíte não respondeu. Confira a conexão e tente de novo.</span>
          <button type="button" className="btn btn-s" onClick={() => setAttempt((value) => value + 1)}><RefreshCw size={16} /> Tentar de novo</button>
        </div>
      )}
      {load.state === 'ready' && !groups.length && (
        <div className="notifications-empty">
          <Bell size={24} />
          <b>Nenhuma notificação por enquanto</b>
          <span>Proposta aprovada, novo acesso à proposta e contas a vencer aparecem aqui e no celular.</span>
        </div>
      )}
      {load.state === 'ready' && groups.map(([name, list]) => (
        <section key={name} className="notifications-group" aria-label={name}>
          <h3>{name}</h3>
          {list.map((notice) => (
            <button key={notice.id} type="button" className={`notification-row${notice.read ? '' : ' novo'}`} onClick={() => void open(notice)}>
              <span className="notification-dot" aria-hidden="true" />
              <span className="notification-text">
                <b>{notice.title}</b>
                <span>{notice.body}</span>
                <small>{noticeHour(notice.createdAt)}{notice.read ? '' : <span className="sr-only"> (nova)</span>}</small>
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
