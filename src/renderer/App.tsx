import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bell,
  Box,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  Eye,
  ExternalLink,
  FilePlus2,
  FileText,
  Filter,
  Grid2X2,
  HelpCircle,
  Layers3,
  LockKeyhole,
  Plus,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';

type ProposalItem = {
  code: string;
  description: string;
  quantity: string;
  unit: string;
  unitCost: string;
  totalCost: string;
  unitSale: string;
  totalSale: string;
};

const proposalItems: ProposalItem[] = [
  { code: 'MAT-AC-001', description: 'Controladora de acesso 2 portas TCP/IP', quantity: '1,00', unit: 'un', unitCost: '1.250,00', totalCost: '1.250,00', unitSale: '1.812,50', totalSale: '1.812,50' },
  { code: 'LEI-AC-002', description: 'Leitor facial IP Wiegand', quantity: '2,00', unit: 'un', unitCost: '1.150,00', totalCost: '2.300,00', unitSale: '1.667,50', totalSale: '3.335,00' },
  { code: 'LEI-AC-003', description: 'Leitor de cartão proximidade 13,56 MHz', quantity: '4,00', unit: 'un', unitCost: '210,00', totalCost: '840,00', unitSale: '315,00', totalSale: '1.260,00' },
  { code: 'BTA-AC-004', description: 'Botoeira de saída inox', quantity: '2,00', unit: 'un', unitCost: '65,00', totalCost: '130,00', unitSale: '97,50', totalSale: '195,00' },
  { code: 'FEC-AC-005', description: 'Fechadura eletromagnética 280 kgf', quantity: '2,00', unit: 'un', unitCost: '320,00', totalCost: '640,00', unitSale: '480,00', totalSale: '960,00' },
  { code: 'FON-AC-006', description: 'Fonte 12V 5A com nobreak', quantity: '2,00', unit: 'un', unitCost: '260,00', totalCost: '520,00', unitSale: '390,00', totalSale: '780,00' },
  { code: 'CAB-UTP-001', description: 'Cabo de rede Cat.6 U/UTP 305m', quantity: '1,00', unit: 'cx', unitCost: '950,00', totalCost: '950,00', unitSale: '1.425,00', totalSale: '1.425,00' },
  { code: 'CAB-2P-001', description: 'Cabo 2x18 AWG blindado', quantity: '100,00', unit: 'm', unitCost: '6,20', totalCost: '620,00', unitSale: '9,30', totalSale: '930,00' },
  { code: 'CON-DIN-001', description: 'Conector RJ45 Cat.6', quantity: '20,00', unit: 'un', unitCost: '4,50', totalCost: '90,00', unitSale: '6,75', totalSale: '135,00' },
  { code: 'INF-ELE-001', description: 'Eletroduto corrugado 3/4”', quantity: '50,00', unit: 'm', unitCost: '3,80', totalCost: '190,00', unitSale: '5,70', totalSale: '285,00' },
  { code: 'INF-CAI-001', description: 'Caixa 4x2 de embutir', quantity: '10,00', unit: 'un', unitCost: '2,60', totalCost: '26,00', unitSale: '3,90', totalSale: '39,00' },
  { code: 'SER-INST-001', description: 'Instalação e configuração do sistema', quantity: '1,00', unit: 'sv', unitCost: '6.800,00', totalCost: '6.800,00', unitSale: '9.860,00', totalSale: '9.860,00' },
  { code: 'SER-TRE-001', description: 'Treinamento de usuários (até 8h)', quantity: '1,00', unit: 'sv', unitCost: '350,00', totalCost: '350,00', unitSale: '525,00', totalSale: '525,00' },
  { code: 'SER-DOC-001', description: 'Documentação técnica e as-built', quantity: '1,00', unit: 'sv', unitCost: '120,00', totalCost: '120,00', unitSale: '180,00', totalSale: '180,00' },
];

const catalogItems: ProposalItem[] = [
  ...proposalItems,
  { code: 'LEI-QR-004', description: 'Leitor de QR Code para acesso', quantity: '1,00', unit: 'un', unitCost: '485,00', totalCost: '485,00', unitSale: '727,50', totalSale: '727,50' },
];

const navItems = [
  { label: 'Início', icon: Grid2X2 },
  { label: 'Propostas', icon: FileText, active: true },
  { label: 'Catálogo', icon: Box },
  { label: 'Clientes', icon: Users },
  { label: 'Kits', icon: Layers3 },
  { label: 'Configurações', icon: Settings },
];

const openProposals = ['PA-1054 • REV.00', 'PA-1052 • REV.01', 'PA-1048 • REV.00'];

export function App() {
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [query, setQuery] = useState('leit');
  const [notice, setNotice] = useState('');
  const [selectedCatalogIndex, setSelectedCatalogIndex] = useState(0);
  const catalogInputRef = useRef<HTMLInputElement>(null);

  const catalogResults = useMemo(
    () => catalogItems.filter((item) => `${item.code} ${item.description}`.toLowerCase().includes(query.toLowerCase())).slice(0, 3),
    [query],
  );

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  useEffect(() => {
    setSelectedCatalogIndex(0);
  }, [query]);

  useEffect(() => {
    if (catalogOpen) window.requestAnimationFrame(() => catalogInputRef.current?.focus());
  }, [catalogOpen]);

  useEffect(() => {
    const announce = (message: string) => {
      setNotice(message);
      window.setTimeout(() => setNotice(''), 2600);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        const action = event.key.toLowerCase();
        if (['k', 'i', 's', 'p', 'g'].includes(action)) event.preventDefault();
        if (action === 'k') {
          setCatalogOpen(true);
          announce('Busca local aberta.');
        } else if (action === 'i') {
          setCatalogOpen(true);
        } else if (action === 's') {
          announce('Revisão salva localmente.');
        } else if (action === 'p') {
          announce('Abrindo a pré-visualização do cliente.');
        } else if (action === 'g') {
          announce('Proposta preparada para geração.');
        }
        return;
      }

      if (!catalogOpen) return;
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && catalogResults.length > 0) {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setSelectedCatalogIndex((current) => (current + direction + catalogResults.length) % catalogResults.length);
      } else if (event.key === 'Enter' && catalogResults[selectedCatalogIndex]) {
        event.preventDefault();
        setCatalogOpen(false);
        announce(`${catalogResults[selectedCatalogIndex].description} adicionado à proposta.`);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setCatalogOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [catalogOpen, catalogResults, selectedCatalogIndex]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Construtec Orçamentos</div>
        <div className="local-state"><span aria-hidden="true" /> Offline <button type="button">Dados locais <ChevronDown size={14} /></button></div>
        <button className="global-search" type="button" onClick={() => setCatalogOpen(true)}>
          <Search size={17} /><span>Buscar</span><kbd>Ctrl+K</kbd>
        </button>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notificações" type="button"><Bell size={18} /></button>
          <button className="icon-button" aria-label="Ajuda" type="button"><HelpCircle size={18} /></button>
          <span className="divider" />
          <button className="profile" type="button"><span>MR</span><b>Marcos Ribeiro</b><ChevronDown size={14} /></button>
        </div>
      </header>

      <aside className="sidebar" aria-label="Navegação principal">
        <nav>
          {navItems.map(({ label, icon: Icon, active }) => (
            <button key={label} type="button" className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              <Icon size={22} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="collapse" type="button"><ChevronLeft size={17} /><span>Recolher</span></button>
      </aside>

      <main className="workspace">
        <div className="proposal-tabs" role="tablist" aria-label="Propostas abertas">
          {openProposals.map((proposal, index) => (
            <button key={proposal} className={index === 0 ? 'selected' : ''} type="button" role="tab" aria-selected={index === 0}>
              {proposal}{index > 0 && <span aria-hidden="true">×</span>}
            </button>
          ))}
          <button type="button" className="new-tab"><Plus size={17} /> Nova proposta</button>
        </div>

        <section className="proposal-editor" aria-label="Editor da proposta PA-1054 revisão 00">
          <div className="proposal-meta">
            <MetaField label="Cliente" value="Edifício Horizonte" icon={<Building2 size={19} />} />
            <MetaField label="Escopo" value="Controle de acesso" />
            <MetaField label="Status" value="Em edição" accent />
            <MetaField label="Validade" value="15/06/2025" />
            <MetaField label="Responsável" value="Marcos Ribeiro" />
          </div>

          <div className="section-tabs" role="tablist" aria-label="Seções da proposta">
            {['Itens', 'Serviços', 'Kits', 'Condições', 'Histórico'].map((tab, index) => (
              <button key={tab} type="button" className={index === 0 ? 'selected' : ''} role="tab" aria-selected={index === 0}>{tab}</button>
            ))}
          </div>

          <div className="toolbar" aria-label="Ações dos itens">
            <button className="primary compact" type="button" onClick={() => setCatalogOpen((value) => !value)}><Plus size={17} /> Inserir <ChevronDown size={14} /></button>
            <button type="button"><Trash2 size={16} /> Excluir</button>
            <button type="button"><Copy size={16} /> Duplicar</button>
            <button type="button">Mover <ChevronDown size={14} /></button>
            <button type="button">Mais <ChevronDown size={14} /></button>
            <span className="toolbar-space" />
            <button type="button">Importar <ChevronDown size={14} /></button>
            <button className="icon-button" aria-label="Configurar colunas" type="button"><SlidersHorizontal size={18} /></button>
            <button className="icon-button" aria-label="Filtrar itens" type="button"><Filter size={18} /></button>
            <button className="icon-button" aria-label="Configurações da tabela" type="button"><Settings size={18} /></button>
          </div>

          <div className="table-region">
            <table>
              <thead>
                <tr>
                  <th aria-label="Selecionar"><input type="checkbox" aria-label="Selecionar todos os itens" /></th>
                  <th>#</th><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Unid.</th><th>Custo unit. (R$)</th><th>Custo total (R$)</th><th>Venda unit. (R$)</th><th>Venda total (R$)</th>
                </tr>
              </thead>
              <tbody>
                {proposalItems.map((item, index) => (
                  <tr key={item.code}>
                    <td><input type="checkbox" aria-label={`Selecionar ${item.description}`} /></td>
                    <td>{index + 1}</td><td className="code">{item.code}</td><td>{item.description}</td><td className="number">{item.quantity}</td><td>{item.unit}</td><td className="number">{item.unitCost}</td><td className="number">{item.totalCost}</td><td className="number">{item.unitSale}</td><td className="number">{item.totalSale}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>14 itens</td><td colSpan={4} /><td className="number">18.430,00</td><td /><td className="number">26.723,50</td></tr>
              </tfoot>
            </table>
          </div>

          <button className="add-line" type="button" onClick={() => setCatalogOpen(true)}><Plus size={16} /> Adicionar linha <kbd>Ctrl+I</kbd></button>

          {catalogOpen && (
            <div className="catalog-popover" role="dialog" aria-label="Buscar no catálogo">
              <div className="popover-heading"><b>Buscar no catálogo</b><button type="button" onClick={() => showNotice('Catálogo completo aberto em uma nova área de trabalho.')}>Ver catálogo completo <ExternalLink size={12} /></button></div>
              <label className="catalog-search"><Search size={15} /><input ref={catalogInputRef} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Pesquisar no catálogo" aria-activedescendant={catalogResults[selectedCatalogIndex] ? `catalog-${catalogResults[selectedCatalogIndex].code}` : undefined} /><kbd>Esc</kbd></label>
              <div className="catalog-results">
                {catalogResults.map((item, index) => (
                  <button id={`catalog-${item.code}`} key={item.code} className={index === selectedCatalogIndex ? 'highlighted' : ''} type="button" onMouseEnter={() => setSelectedCatalogIndex(index)} onClick={() => { setCatalogOpen(false); showNotice(`${item.description} adicionado à proposta.`); }}>
                    <span className="code">{item.code}</span><span>{item.description}</span><small>Unid.: {item.unit}</small><small>Custo: R$ {item.unitCost}</small>
                  </button>
                ))}
              </div>
              <div className="popover-footer"><span>↑↓ Navegar</span><span><kbd>Enter</kbd> Inserir</span><span><kbd>Esc</kbd> Fechar</span></div>
            </div>
          )}
        </section>

        <aside className="commercial-panel">
          <div className="panel-title"><b>Resumo comercial</b><ChevronUp size={16} /></div>
          <Amount label="Custo (materiais + serviços)" value="R$ 18.430,00" />
          <Amount label="Venda total" value="R$ 26.723,50" tone="blue" />
          <Amount label="Resultado bruto" value="R$ 8.293,50" tone="green" />
          <Amount label="Margem" value="31,01%" tone="green" compact />

          <div className="panel-section">
            <h2>Parâmetros internos</h2>
            <label>BDI aplicado <span className="locked-input">1,45 <LockKeyhole size={15} /></span></label>
            <label>Encargos <span className="locked-input">87,25% <ChevronDown size={14} /></span></label>
          </div>

          <div className="frozen-state"><LockKeyhole size={17} /><span>Preço congelado nesta revisão</span></div>

          <div className="panel-section actions">
            <h2>Ações</h2>
            <button type="button" onClick={() => showNotice('Revisão salva localmente.')}><Save size={18} /> Salvar revisão <kbd>Ctrl+S</kbd></button>
            <button type="button" onClick={() => showNotice('Abrindo a pré-visualização do cliente.')}><Eye size={18} /> Pré-visualizar <kbd>Ctrl+P</kbd></button>
            <button className="primary generate" type="button" onClick={() => showNotice('Proposta preparada para geração.')}><FilePlus2 size={18} /> Gerar proposta <kbd>Ctrl+G</kbd></button>
          </div>
          <div className="panel-footnote">
            <p className="demo-data-note">Ambiente demonstrativo · dados sintéticos</p>
            <p className="last-change">Última alteração: hoje 10:24<br />por Marcos Ribeiro</p>
          </div>
        </aside>
      </main>

      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

function MetaField({ label, value, icon, accent = false }: { label: string; value: string; icon?: ReactNode; accent?: boolean }) {
  return <div className="meta-field"><span>{label}</span><button type="button" className={accent ? 'accent' : ''}>{icon}{value}<ChevronDown size={14} /></button></div>;
}

function Amount({ label, value, tone, compact = false }: { label: string; value: string; tone?: 'blue' | 'green'; compact?: boolean }) {
  return <div className={`amount ${tone ?? ''} ${compact ? 'compact' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}
