import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  ExternalLink,
  FileSpreadsheet,
  Headset,
  Layers,
} from 'lucide-react';
import { CENTRO_CUSTOS_CLOUD_URL, getCentroCustosUrl } from './api';

/* Dominio oficial do ChamadoPro na Suite Construtec. */
const CHAMADOPRO_URL = 'https://chamadopro-app.lucas-coelho5923.workers.dev/';

interface SuiteSwitcherPopoverProps {
  activeApp?: 'orcamentos' | 'centro-custos';
  onSelectApp?: (app: 'orcamentos' | 'centro-custos' | 'hub') => void;
  onClose: () => void;
}

export function SuiteSwitcherPopover({
  activeApp = 'orcamentos',
  onSelectApp,
  onClose,
}: SuiteSwitcherPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [centroUrl, setCentroUrl] = useState(CENTRO_CUSTOS_CLOUD_URL);

  useEffect(() => {
    void getCentroCustosUrl().then(setCentroUrl);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (popoverRef.current && popoverRef.current.contains(event.target as Node)) {
        return;
      }
      const toggleBtn = document.getElementById('btn-suite-switcher');
      if (toggleBtn && (toggleBtn === event.target || toggleBtn.contains(event.target as Node))) {
        return;
      }
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  const handleOpenUrl = (url: string) => {
    try {
      if (window.construtec?.openExternal) {
        void window.construtec.openExternal(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  const handleSelectModule = (app: 'orcamentos' | 'centro-custos') => {
    if (app === 'centro-custos') {
      handleOpenUrl(centroUrl);
      return;
    }
    if (onSelectApp) {
      onSelectApp(app);
      onClose();
    } else {
      onClose();
    }
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

      {activeApp === 'orcamentos' ? (
        <div className="suite-dropdown-item current-system" role="menuitem" aria-current="page">
          <span className="suite-item-icon">
            <FileSpreadsheet size={15} />
          </span>
          <div className="suite-item-text">
            <strong>Construtec Orçamentos</strong>
            <small>Etapa 01: Propostas e BDI</small>
          </div>
          <span className="suite-current-badge">Atual</span>
        </div>
      ) : (
        <button
          type="button"
          className="suite-dropdown-item"
          onClick={() => handleSelectModule('orcamentos')}
          role="menuitem"
        >
          <span className="suite-item-icon">
            <FileSpreadsheet size={15} />
          </span>
          <div className="suite-item-text">
            <strong>Construtec Orçamentos</strong>
            <small>Etapa 01: Propostas e BDI</small>
          </div>
        </button>
      )}

      {activeApp === 'centro-custos' ? (
        <div className="suite-dropdown-item current-system" role="menuitem" aria-current="page">
          <span className="suite-item-icon">
            <Building2 size={15} />
          </span>
          <div className="suite-item-text">
            <strong>Centro de Custos v3</strong>
            <small>Etapa 02: Gestão ativa de obras</small>
          </div>
          <span className="suite-current-badge">Atual</span>
        </div>
      ) : (
        <button
          type="button"
          className="suite-dropdown-item"
          onClick={() => handleSelectModule('centro-custos')}
          role="menuitem"
        >
          <span className="suite-item-icon">
            <Building2 size={15} />
          </span>
          <div className="suite-item-text">
            <strong>Centro de Custos v3</strong>
            <small>Etapa 02: Gestão ativa de obras</small>
          </div>
          <ExternalLink size={12} className="suite-item-ext" />
        </button>
      )}

      <button
        type="button"
        className="suite-dropdown-item"
        onClick={() => handleOpenUrl(CHAMADOPRO_URL)}
        role="menuitem"
        title="Abrir Chamados e O.S. em nova aba"
      >
        <span className="suite-item-icon">
          <Headset size={15} />
        </span>
        <div className="suite-item-text">
          <strong>Chamados &amp; O.S.</strong>
          <small>Etapa 03: ChamadoPro integrado</small>
        </div>
        <ExternalLink size={12} className="suite-item-ext" />
      </button>
    </div>
  );
}
