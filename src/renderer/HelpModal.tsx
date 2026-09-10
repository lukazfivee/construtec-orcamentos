import { useEffect, useState } from 'react';
import {
  Calculator,
  Command,
  FileCheck2,
  HelpCircle,
  Info,
  Lock,
  X,
} from 'lucide-react';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

type TabKey = 'shortcuts' | 'calculations' | 'privacy' | 'about';

export function HelpModal({ open, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('shortcuts');

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop help-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog help-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="help-modal-header">
          <div className="help-modal-title-group">
            <span className="help-modal-icon-badge">
              <HelpCircle size={22} />
            </span>
            <div>
              <h2 id="help-modal-title">Central de Ajuda & Diretrizes</h2>
              <p>Atalhos rápidos, regras comerciais e diretrizes operacionais do Construtec Orçamentos</p>
            </div>
          </div>
          <button
            type="button"
            className="help-modal-close-btn"
            onClick={onClose}
            aria-label="Fechar Central de Ajuda"
          >
            <X size={18} />
          </button>
        </header>

        <nav className="help-modal-tabs" aria-label="Seções de ajuda">
          <button
            type="button"
            className={activeTab === 'shortcuts' ? 'active' : ''}
            onClick={() => setActiveTab('shortcuts')}
          >
            <Command size={15} /> Atalhos de Teclado
          </button>
          <button
            type="button"
            className={activeTab === 'calculations' ? 'active' : ''}
            onClick={() => setActiveTab('calculations')}
          >
            <Calculator size={15} /> Metodologia de Cálculo
          </button>
          <button
            type="button"
            className={activeTab === 'privacy' ? 'active' : ''}
            onClick={() => setActiveTab('privacy')}
          >
            <Lock size={15} /> Sigilo & Imutabilidade
          </button>
          <button
            type="button"
            className={activeTab === 'about' ? 'active' : ''}
            onClick={() => setActiveTab('about')}
          >
            <Info size={15} /> Sobre o Sistema
          </button>
        </nav>

        <div className="help-modal-content">
          {activeTab === 'shortcuts' && (
            <div className="help-section">
              <p className="help-section-desc">
                Agilize o lançamento de itens e a navegação no sistema utilizando as teclas de atalho:
              </p>
              <div className="help-shortcuts-grid">
                <div className="shortcut-card">
                  <div className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>K</kbd></div>
                  <div className="shortcut-info">
                    <strong>Busca rápida no Catálogo</strong>
                    <span>Abre o catálogo de materiais e serviços para pesquisa imediata.</span>
                  </div>
                </div>
                <div className="shortcut-card">
                  <div className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>I</kbd></div>
                  <div className="shortcut-info">
                    <strong>Inserir Item</strong>
                    <span>Abre a gaveta do catálogo para adicionar itens à proposta ativa.</span>
                  </div>
                </div>
                <div className="shortcut-card">
                  <div className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>S</kbd></div>
                  <div className="shortcut-info">
                    <strong>Criar Nova Revisão</strong>
                    <span>Gera a próxima revisão imutável (ex: REV.01) preservando a anterior.</span>
                  </div>
                </div>
                <div className="shortcut-card">
                  <div className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>P</kbd></div>
                  <div className="shortcut-info">
                    <strong>Pré-visualizar Proposta</strong>
                    <span>Abre a pré-visualização comercial formatada para apresentação ao cliente.</span>
                  </div>
                </div>
                <div className="shortcut-card">
                  <div className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>G</kbd></div>
                  <div className="shortcut-info">
                    <strong>Exportar Documentos</strong>
                    <span>Gera os arquivos oficiais da proposta em PDF e Word (.docx).</span>
                  </div>
                </div>
                <div className="shortcut-card">
                  <div className="shortcut-keys"><kbd>Esc</kbd></div>
                  <div className="shortcut-info">
                    <strong>Fechar Modais / Cancelar</strong>
                    <span>Fecha gavetas de catálogo, caixas de diálogo, popovers e modais.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calculations' && (
            <div className="help-section">
              <div className="help-calc-item">
                <h3>BDI — Benefícios e Despesas Indiretas</h3>
                <p>
                  O BDI compõe os custos indiretos, administração central, impostos, seguros e a margem de lucro prevista.
                  É aplicado sobre o custo base dos insumos e serviços:
                </p>
                <div className="help-formula-box">
                  <code>Preço de Venda = Custo Base × (1 + BDI% / 100)</code>
                </div>
              </div>

              <div className="help-calc-item">
                <h3>Mão de Obra e Encargos Sociais</h3>
                <p>
                  A taxa horária operacional de cada profissional considera o salário-base somado aos adicionais legais
                  (periculosidade/insalubridade) e ao percentual de encargos sociais e trabalhistas da categoria:
                </p>
                <div className="help-formula-box">
                  <code>Custo Horário = (Salário Base × (1 + Encargos%)) ÷ 220 horas mensais</code>
                </div>
              </div>

              <div className="help-calc-item">
                <h3>Precisão e Arredondamento Financeiro</h3>
                <p>
                  Todos os cálculos operam com precisão decimal em centavos e formatação estrita no padrão monetário brasileiro
                  (<code>R$ 1.250,00</code>), evitando perdas ou divergências cumulativas de arredondamento.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="help-section">
              <div className="help-privacy-card">
                <div className="privacy-badge"><Lock size={18} /> Sigilo Comercial Estrito</div>
                <p>
                  Informações estratégicas internas — como custo de aquisição de fornecedores, salários de funcionários,
                  margem líquida da Construtec e taxa detalhada de BDI — <strong>nunca são expostas nos documentos de exportação (PDF e Word)</strong> entregues ao cliente.
                </p>
                <p>
                  O cliente final recebe apenas os valores unitários e totais comerciais de venda com escopo técnico transparente.
                </p>
              </div>

              <div className="help-privacy-card">
                <div className="privacy-badge"><FileCheck2 size={18} /> Imutabilidade de Revisões</div>
                <p>
                  Cada proposta gerada possui snapshots congelados de todos os seus itens. Se o preço de um material for alterado no catálogo posteriormente,
                  <strong>as propostas já emitidas não sofrem nenhuma alteração</strong>, resguardando o histórico e a validade jurídica dos orçamentos aprovados.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="help-section">
              <div className="help-about-details">
                <div className="about-row">
                  <span>Software:</span>
                  <strong>Construtec Orçamentos</strong>
                </div>
                <div className="about-row">
                  <span>Arquitetura:</span>
                  <strong>Desktop Local-First (Operação 100% Offline)</strong>
                </div>
                <div className="about-row">
                  <span>Banco de Dados:</span>
                  <strong>PGlite (PostgreSQL embutido localmente)</strong>
                </div>
                <div className="about-row">
                  <span>Empresa:</span>
                  <strong>LAC Construtec Construtora Eireli</strong>
                </div>
                <div className="about-row">
                  <span>Segurança:</span>
                  <strong>Sessão JWT com criptografia local e hash seguro de senhas</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="help-modal-footer">
          <span className="help-modal-footer-tip">
            Pressione <kbd>Esc</kbd> para fechar a qualquer momento.
          </span>
          <button type="button" className="primary compact" onClick={onClose}>
            Entendido
          </button>
        </footer>
      </div>
    </div>
  );
}
