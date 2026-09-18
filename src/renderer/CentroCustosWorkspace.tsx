import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ExternalLink,
  Layers,
  RotateCw,
} from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { getCentroCustosUrl, isCloudRuntime } from './api';

interface Props {
  activeProposal?: ProposalDetail | null;
  targetCostCenterId?: number | null;
  onBackToProposal?: () => void;
  onNotice?: (message: string) => void;
}

export function CentroCustosWorkspace({
  activeProposal,
  targetCostCenterId,
  onBackToProposal,
  onNotice,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState<boolean | null>(null);
  const [baseAppUrl, setBaseAppUrl] = useState('http://localhost:3333');

  useEffect(() => {
    void getCentroCustosUrl().then(setBaseAppUrl);
  }, []);
  const iframeUrl = targetCostCenterId
    ? `${baseAppUrl}/#obra=${targetCostCenterId}`
    : `${baseAppUrl}/`;

  const checkHealth = async () => {
    try {
      const res = await fetch(`${baseAppUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
      setOnline(res.ok);
    } catch {
      setOnline(false);
    }
  };

  useEffect(() => {
    // Na nuvem, cada app roda como Worker independente; o ping de saude
    // (fetch entre origens) e' bloqueado por CORS mesmo quando o outro
    // servico esta no ar, e a mensagem de ".bat local"/"Portal Hub" nao
    // se aplica -- o iframe carrega direto, sem esse gate.
    if (isCloudRuntime()) return undefined;
    void checkHealth();
    const timer = setInterval(() => void checkHealth(), 10000);
    return () => clearInterval(timer);
  }, []);

  const handleReload = () => {
    setLoading(true);
    void checkHealth();
    if (iframeRef.current) {
      iframeRef.current.src = iframeUrl;
    }
    onNotice?.('Painel do Centro de Custos recarregado.');
  };

  const handleOpenExternal = () => {
    if (window.construtec?.openExternal) {
      void window.construtec.openExternal(iframeUrl);
    } else {
      window.open(iframeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="centro-custos-workspace">
      <div className="cc-control-bar">
        <div className="cc-control-left">
          {onBackToProposal && (
            <button
              type="button"
              className="cc-back-btn"
              onClick={onBackToProposal}
              title="Retornar à tela de elaboração de propostas"
            >
              <ArrowLeft size={15} />
              <span>Voltar para {activeProposal ? activeProposal.number : 'Propostas'}</span>
            </button>
          )}

          <div className="cc-badge-step">
            <Layers size={13} />
            <span>Etapa 02 · Gestão de Obras</span>
          </div>

          {!isCloudRuntime() && (
            <div className="cc-status-indicator">
              <span className={`status-dot ${online === true ? 'green' : online === false ? 'red' : 'yellow'}`} />
              <span>{online === true ? `Centro de Custos Online (${new URL(baseAppUrl).port ? `:${new URL(baseAppUrl).port}` : ''})` : online === false ? 'Servidor Desconectado' : 'Conectando…'}</span>
            </div>
          )}
        </div>

        <div className="cc-control-right">
          <button
            type="button"
            className="cc-action-btn"
            onClick={handleReload}
            title="Recarregar tela do Centro de Custos"
          >
            <RotateCw size={14} />
            <span>Recarregar</span>
          </button>

          <button
            type="button"
            className="cc-action-btn"
            onClick={handleOpenExternal}
            title="Abrir Centro de Custos em janela externa (dual monitor)"
          >
            <ExternalLink size={14} />
            <span>Janela externa</span>
          </button>
        </div>
      </div>

      <div className="cc-frame-container">
        {!isCloudRuntime() && online === false ? (
          <div className="cc-offline-card">
            <AlertTriangle size={36} color="#eab308" />
            <h3>Centro de Custos não iniciado</h3>
            <p>
              O serviço do Centro de Custos não foi detectado em <code>{baseAppUrl}</code>.
              <br />
              Utilize o <strong>INICIAR-SUITE-CONSTRUTEC.bat</strong> ou inicie pelo Portal Hub.
            </p>
            <div className="cc-offline-actions">
              <button
                type="button"
                className="btn-gerar-centro"
                style={{ width: 'auto', padding: '0 20px' }}
                onClick={handleReload}
              >
                <RotateCw size={15} /> Tentar reconectar
              </button>
              <button
                type="button"
                className="gerar-centro-btn-secondary"
                onClick={() => window.open('http://localhost:3000', '_blank')}
              >
                <Building2 size={15} /> Abrir Portal Hub (:3000)
              </button>
            </div>
          </div>
        ) : (
          <>
            {loading && (
              <div className="cc-frame-loading">
                <RotateCw size={24} className="spinning" color="#01b7f1" />
                <span>Carregando Centro de Custos integrado…</span>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={iframeUrl}
              title="Centro de Custos Construtec"
              className="cc-embedded-iframe"
              onLoad={() => setLoading(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}
