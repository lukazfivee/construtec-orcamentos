import { useEffect, useRef } from 'react';
import { ExternalLink, Layers } from 'lucide-react';

interface SuiteSwitcherPopoverProps {
  onClose: () => void;
}

export function SuiteSwitcherPopover({ onClose }: SuiteSwitcherPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const handleOpenUrl = (url: string) => {
    if (window.construtec?.openExternal) {
      void window.construtec.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
    onClose();
  };

  return (
    <div
      className="suite-dropdown-menu"
      ref={popoverRef}
      role="menu"
      aria-label="Alternar entre sistemas da Suíte Construtec"
    >
      <div className="suite-dropdown-header">
        <Layers size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} />
        Esteira Operacional Construtec
      </div>

      <button
        type="button"
        className="suite-dropdown-item hub-link"
        onClick={() => handleOpenUrl('http://localhost:3000')}
        role="menuitem"
      >
        <span className="suite-item-icon">◫</span>
        <div className="suite-item-text">
          <strong>Portal Hub</strong>
          <small>Launcher e esteira de trabalho</small>
        </div>
        <ExternalLink size={12} className="suite-item-ext" />
      </button>

      <div className="suite-dropdown-sep" />

      <div className="suite-dropdown-item current-system" role="menuitem" aria-current="page">
        <span className="suite-item-icon">📋</span>
        <div className="suite-item-text">
          <strong>Construtec Orçamentos</strong>
          <small>Etapa 01: Propostas e BDI</small>
        </div>
        <span className="suite-current-badge">Atual</span>
      </div>

      <button
        type="button"
        className="suite-dropdown-item"
        onClick={() => handleOpenUrl('http://localhost:3333')}
        role="menuitem"
      >
        <span className="suite-item-icon">💰</span>
        <div className="suite-item-text">
          <strong>Centro de Custos v3</strong>
          <small>Etapa 02: Gestão ativa de obras</small>
        </div>
        <ExternalLink size={12} className="suite-item-ext" />
      </button>

      <div
        className="suite-dropdown-item disabled-system"
        role="menuitem"
        aria-disabled="true"
        title="Módulo em preparação"
      >
        <span className="suite-item-icon">🛠</span>
        <div className="suite-item-text">
          <strong>Chamados & O.S.</strong>
          <small>Etapa 03: Em preparação</small>
        </div>
        <span className="suite-soon-badge">Em breve</span>
      </div>
    </div>
  );
}

