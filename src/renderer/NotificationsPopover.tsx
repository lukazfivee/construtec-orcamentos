import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
} from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { plural } from '../shared/formatoBr';

interface NotificationsPopoverProps {
  proposal: ProposalDetail | null;
  onClose: () => void;
}

export function NotificationsPopover({ proposal, onClose }: NotificationsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [clearedDivergence, setClearedDivergence] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  const divergentItems = (!clearedDivergence && proposal?.isLatest)
    ? proposal.items.filter(
        (item) =>
          item.catalogCurrentCost !== null &&
          item.catalogCurrentCost !== undefined &&
          Math.abs(item.catalogCurrentCost - item.unitCost) >= 0.01
      )
    : [];

  return (
    <div className="notifications-popover" ref={popoverRef} role="dialog" aria-label="Notificações do sistema">
      <div className="notifications-header">
        <div className="notifications-title">
          <Bell size={16} />
          <strong>Notificações</strong>
        </div>
        {divergentItems.length > 0 && (
          <button
            type="button"
            className="notifications-clear-btn"
            onClick={() => setClearedDivergence(true)}
            title="Marcar divergências como vistas"
          >
            <CheckCheck size={14} /> Dispensar
          </button>
        )}
      </div>

      <div className="notifications-list">
        {divergentItems.length > 0 && (
          <div className="notification-card warning">
            <div className="notification-icon warning">
              <AlertTriangle size={16} />
            </div>
            <div className="notification-body">
              <strong>Custo novo no catálogo</strong>
              <p>
                {plural(divergentItems.length, 'item', 'itens')} da proposta <b>{proposal?.number}</b> {divergentItems.length === 1 ? 'tem' : 'têm'} custo diferente no catálogo.
              </p>
              <small>O selo na tabela de itens mostra o custo novo; atualize se quiser.</small>
            </div>
          </div>
        )}

        {divergentItems.length === 0 && <p className="notifications-empty">Nenhum aviso agora.</p>}
      </div>
    </div>
  );
}
