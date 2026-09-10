import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';

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
          <strong>Notificações & Alertas</strong>
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
              <strong>Divergência de Custos</strong>
              <p>
                {divergentItems.length} item(ns) na proposta <b>{proposal?.number}</b> possuem custo atualizado no catálogo local.
              </p>
              <small>Verifique os badges na tabela de itens para sincronizar se desejar.</small>
            </div>
          </div>
        )}

        {proposal && (
          <div className="notification-card info">
            <div className="notification-icon info">
              <FileSpreadsheet size={16} />
            </div>
            <div className="notification-body">
              <strong>Proposta Ativa: {proposal.number}</strong>
              <p>
                Revisão <b>REV.{String(proposal.revision).padStart(2, '0')}</b> —{' '}
                {proposal.status === 'draft' ? 'Rascunho em edição' : proposal.status === 'approved' ? 'Aprovada' : 'Emitida'}
              </p>
              <small>{proposal.isLatest ? 'Modo de edição habilitado.' : 'Modo histórico somente leitura.'}</small>
            </div>
          </div>
        )}

        <div className="notification-card success">
          <div className="notification-icon success">
            <Database size={16} />
          </div>
          <div className="notification-body">
            <strong>Banco Local PGlite Conectado</strong>
            <p>Operação local-first ativa e íntegra. Todos os dados são persistidos neste computador.</p>
            <small>
              <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
              100% Offline e seguro
            </small>
          </div>
        </div>
      </div>

      <div className="notifications-footer">
        <span>Construtec Orçamentos • Central Operacional</span>
      </div>
    </div>
  );
}
