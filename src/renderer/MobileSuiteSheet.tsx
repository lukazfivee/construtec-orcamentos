import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Building2, ChevronRight, CornerDownRight, FileText, Layers, Wrench, X } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { CENTRO_CUSTOS_CLOUD_URL, getCentroCustosUrl } from './api';
import { CHAMADOPRO_URL, SUITE_MENU_TITLE } from './suiteMenu';

// Seletor "Suite" no celular (Fase 4 da Suite mobile): folha inferior com os
// apps da esteira. Dentro do app Android, Orcamentos e Centro de Custos trocam
// de WebView por suite://app/<id>; o ChamadoPro sempre abre no navegador.
const inSuiteApp = typeof navigator !== 'undefined' && /SuiteConstrutec\//.test(navigator.userAgent);

const go = (url: string, external = false) => {
  if (external && !inSuiteApp) window.open(url, '_blank', 'noopener,noreferrer');
  else window.location.href = url;
};

interface Props {
  proposal: ProposalDetail | null;
  onClose: () => void;
}

export function MobileSuiteSheet({ proposal, onClose }: Props) {
  const [centroUrl, setCentroUrl] = useState(CENTRO_CUSTOS_CLOUD_URL);
  useEffect(() => {
    void getCentroCustosUrl().then((url) => url && setCentroUrl(url.replace(/\/+$/, '')));
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const obraId = proposal?.costCenterId;
  const openCentro = (obra?: number) => {
    onClose();
    if (inSuiteApp) go(obra ? `suite://app/centro-custos?obra=${obra}` : 'suite://app/centro-custos');
    else go(`${centroUrl}/m/${obra ? `#obra=${obra}` : ''}`, true);
  };

  // Portal no body: dentro da barra do topo a folha ficaria atras do conteudo (camada da topbar).
  return createPortal(
    <div className="proposal-mobile-sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="proposal-mobile-sheet suite-sheet" role="dialog" aria-modal="true" aria-labelledby="suite-sheet-title" onClick={(event) => event.stopPropagation()}>
        <div className="proposal-mobile-sheet-handle" />
        <div className="proposal-mobile-sheet-head">
          <b id="suite-sheet-title"><Layers size={16} /> {SUITE_MENU_TITLE}</b>
          <button type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </div>

        {obraId && (
          <>
            <h3 className="proposal-mobile-sheet-section">Ir direto para</h3>
            <button type="button" className="suite-sheet-context" onClick={() => openCentro(obraId)}>
              <CornerDownRight size={18} />
              <span><b>Obra gerada desta proposta</b><small>{proposal?.number} no Centro de Custos</small></span>
              <ChevronRight size={16} />
            </button>
          </>
        )}

        <h3 className="proposal-mobile-sheet-section">Sistemas</h3>
        <div className="suite-sheet-item current" aria-current="page">
          <FileText size={20} />
          <span><small>Etapa 01</small><b>Orçamentos</b></span>
          <em>Atual</em>
        </div>
        <button type="button" className="suite-sheet-item" onClick={() => openCentro()}>
          <Building2 size={20} />
          <span><small>Etapa 02</small><b>Centro de Custos</b></span>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="suite-sheet-item" onClick={() => { onClose(); go(CHAMADOPRO_URL, true); }}>
          <Wrench size={20} />
          <span><small>Etapa 03</small><b>ChamadoPro</b><small>Abre no navegador</small></span>
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
