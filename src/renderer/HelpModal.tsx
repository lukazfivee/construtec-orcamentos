import { useState } from 'react';
import {
  Calculator,
  Command,
  FileCheck2,
  HelpCircle,
  Info,
  Lock,
  MessageSquareWarning,
} from 'lucide-react';
import { ReportProblemForm } from './ReportProblemForm';
import { Dialogo } from './orcDeskUi';
import { isCloudRuntime } from './api';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

type TabKey = 'shortcuts' | 'calculations' | 'privacy' | 'about' | 'report';

export function HelpModal({ open, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('shortcuts');

  if (!open) return null;
  const cloud = isCloudRuntime();
  const tabs: Array<[TabKey, typeof Command, string]> = [
    ['shortcuts', Command, 'Atalhos'],
    ['calculations', Calculator, 'Cálculo'],
    ['privacy', Lock, 'Sigilo e revisões'],
    ['about', Info, 'Sobre'],
    ['report', MessageSquareWarning, 'Reportar problema'],
  ];

  return (
    <Dialogo
      id="help-modal"
      icon={HelpCircle}
      title="Ajuda"
      sub="Atalhos, regras de cálculo e sigilo do Construtec Orçamentos"
      className="w-lg help-dlg"
      onClose={onClose}
      toolbar={(
        <nav className="dlg-tabs" aria-label="Seções de ajuda">
          {tabs.map(([key, Icon, label]) => (
            <button key={key} type="button" className={activeTab === key ? 'active' : ''} aria-pressed={activeTab === key} onClick={() => setActiveTab(key)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
      )}
      footer={(
        <>
          <span className="dlg-tip">Esc fecha esta janela.</span>
          <button type="button" className="primary" onClick={onClose}>Entendido</button>
        </>
      )}
    >
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
                <h3>BDI e impostos</h3>
                <p>
                  O BDI cobre custos indiretos, administração, seguros e a margem prevista. É um multiplicador aplicado sobre o custo dos materiais e da mão de obra; os impostos entram depois:
                </p>
                <div className="help-formula-box">
                  <code>Preço de venda = custo × BDI (multiplicador, ex.: 1,25) × (1 + impostos %)</code>
                </div>
              </div>

              <div className="help-calc-item">
                <h3>Mão de obra</h3>
                <p>
                  O custo por hora de cada função soma o salário e os custos mensais da pessoa e divide pelas horas do mês
                  (padrão 176 h, em Configurações; cada proposta pode usar outro valor):
                </p>
                <div className="help-formula-box">
                  <code>Custo por hora = (salário + alimentação + transporte + outros) ÷ horas por mês</code>
                </div>
              </div>

              <div className="help-calc-item">
                <h3>Arredondamento</h3>
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
                <div className="privacy-badge"><Lock size={18} /> Sigilo comercial</div>
                <p>
                  Informações estratégicas internas — como custo de aquisição de fornecedores, salários de funcionários,
                  margem líquida da Construtec e taxa detalhada de BDI — <strong>nunca são expostas nos documentos de exportação (PDF e Word)</strong> entregues ao cliente.
                </p>
                <p>
                  O cliente final recebe apenas os valores unitários e totais comerciais de venda com escopo técnico transparente.
                </p>
              </div>

              <div className="help-privacy-card">
                <div className="privacy-badge"><FileCheck2 size={18} /> Revisões não mudam depois de criadas</div>
                <p>
                  Cada proposta gerada possui snapshots congelados de todos os seus itens. Se o preço de um material for alterado no catálogo posteriormente,
                  <strong>as propostas já emitidas não sofrem nenhuma alteração</strong>, resguardando o histórico e a validade jurídica dos orçamentos aprovados.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'report' && <ReportProblemForm />}

          {activeTab === 'about' && (
            <div className="help-section">
              <div className="help-about-details">
                <div className="about-row">
                  <span>Aplicativo</span>
                  <strong>Construtec Orçamentos</strong>
                </div>
                <div className="about-row">
                  <span>Onde roda</span>
                  <strong>{cloud ? 'Site da Suíte, dados na nuvem' : 'Aplicativo do Windows, funciona sem internet'}</strong>
                </div>
                <div className="about-row">
                  <span>Banco de dados</span>
                  <strong>{cloud ? 'PostgreSQL na nuvem' : 'PGlite neste computador'}</strong>
                </div>
                <div className="about-row">
                  <span>Empresa</span>
                  <strong>LAC Construtec Construtora Eireli</strong>
                </div>
                <div className="about-row">
                  <span>Segurança</span>
                  <strong>Sessão JWT com criptografia local e hash seguro de senhas</strong>
                </div>
              </div>
            </div>
          )}
    </Dialogo>
  );
}
