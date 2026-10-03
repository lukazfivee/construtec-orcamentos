import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Download, Eye, FileText, Loader2, LockKeyhole, Mail, MessageCircle, Minus, Plus, RefreshCw, Send, Share2, ShieldCheck, WifiOff,
} from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { proposalApi } from './api';
import { openExternalUrl, printDocument } from './proposalPdfActions';
import { ProposalSendDrawer } from './ProposalSendDrawer';
import {
  PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH, buildPdfPages, defaultPdfChoices, effectiveChoices, formatIsoDate, hasPdfContent, pdfDefaultMessage, pdfFileName, pdfQuery, revLabel,
  type PdfChoices,
} from './proposalPdfPages';
import { useCanEdit, useSuitePermission } from './SuitePermissions';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const ZOOMS = [100, 125, 150, 175, 200];
const THUMB_WIDTH = 84;

// Escolhas por proposta: sobrevivem ao erro de rede e ao "Tentar de novo".
const savedChoices = new Map<string, PdfChoices>();

type Props = {
  proposalId: string;
  onBack: () => void;
  onAddItems: () => void;
  onProposalUpdate: (proposal: ProposalDetail) => void;
  onProposalTabsReload: () => void;
  showNotice: (message: string) => void;
};

type Load = { state: 'loading' } | { state: 'error'; offline: boolean; message: string } | { state: 'ready'; proposal: ProposalDetail };

// PDF da proposta no computador (Rodada 23, telas 23m a 23p): miniaturas, pagina grande com zoom e as opcoes.
// Custo, BDI e margem nunca entram no PDF; "Enviar ao cliente" so com a permissao de envio (p11).
export function ProposalPdfView({ proposalId, onBack, onAddItems, onProposalUpdate, onProposalTabsReload, showNotice }: Props) {
  const canEdit = useCanEdit();
  const p10 = useSuitePermission('p10');
  const p11 = useSuitePermission('p11');
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [choices, setChoices] = useState<PdfChoices>(() => savedChoices.get(proposalId) ?? defaultPdfChoices());
  const [pageIndex, setPageIndex] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 640, height: 560 });
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoad({ state: 'loading' });
    void proposalApi.byId(proposalId)
      .then((result) => { if (active) setLoad({ state: 'ready', proposal: result.proposal }); })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Não foi possível montar o PDF agora.';
        setLoad({ state: 'error', offline: /failed to fetch|network|load failed/i.test(message), message });
      });
    return () => { active = false; };
  }, [proposalId, attempt]);

  useEffect(() => { savedChoices.set(proposalId, choices); }, [proposalId, choices]);

  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return undefined;
    const measure = () => setStageSize((prev) => (prev.width === element.clientWidth && prev.height === element.clientHeight ? prev : { width: element.clientWidth, height: element.clientHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [load.state]);

  useEffect(() => {
    if (!shareOpen) return undefined;
    const onDown = (event: MouseEvent) => { if (!shareRef.current?.contains(event.target as Node)) setShareOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setShareOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [shareOpen]);

  const proposal = load.state === 'ready' ? load.proposal : null;
  const pages = useMemo(() => (proposal ? buildPdfPages(proposal, choices) : []), [proposal, choices]);
  const safeIndex = Math.min(pageIndex, Math.max(0, pages.length - 1));

  const fetchDocument = useCallback(async () => {
    if (!proposal) throw new Error('Proposta não carregada.');
    return proposalApi.documentHtml(proposal.id, pdfQuery(effectiveChoices(choices, proposal)));
  }, [proposal, choices]);

  const download = async () => {
    setBusy(true);
    try { printDocument(await fetchDocument()); showNotice('Escolha "Salvar como PDF" na janela de impressão.'); }
    catch (error) { showNotice(error instanceof Error ? error.message : 'Não foi possível montar o PDF agora.'); }
    finally { setBusy(false); }
  };

  const back = (
    <button type="button" className="page-back" onClick={onBack}><ChevronLeft size={16} /> Voltar à proposta</button>
  );

  if (!proposal) {
    return (
      <main className="workspace-page pdf-page">
        {back}
        <header className="page-head"><div><span className="page-eyebrow">Proposta</span><h1>PDF da proposta</h1>
          <span className="page-sub">{load.state === 'loading' ? 'Gerando a pré-visualização do PDF…' : ''}</span></div></header>
        {load.state === 'loading' ? (
          <div className="pdf-skeleton" role="status" aria-label="Gerando a pré-visualização do PDF"><i /><i /><i /></div>
        ) : (
          <div className="page-empty">
            {load.state === 'error' && load.offline ? <WifiOff size={28} /> : <FileText size={28} />}
            <b>Não deu para gerar o PDF</b>
            <span>{load.state === 'error' && load.offline
              ? 'O PDF é montado no servidor e o computador está sem internet. Suas escolhas de modelo e capa ficam guardadas.'
              : load.state === 'error' ? load.message : ''}</span>
            <div><button type="button" className="flow-btn primary" onClick={() => setAttempt((v) => v + 1)}><RefreshCw size={16} /> Tentar de novo</button>
              <button type="button" className="flow-btn" onClick={onBack}>Voltar à proposta</button></div>
          </div>
        )}
      </main>
    );
  }

  const eff = effectiveChoices(choices, proposal);
  const sub = `${proposal.number} · ${revLabel(proposal.revision)} · ${proposal.workName || '—'} · ${proposal.clientName}`;
  const fileName = pdfFileName(proposal);

  if (!hasPdfContent(proposal)) {
    const canAdd = proposal.status === 'draft' && proposal.isLatest && canEdit;
    return (
      <main className="workspace-page pdf-page">
        {back}
        <header className="page-head"><div><span className="page-eyebrow">Proposta</span><h1>PDF da proposta</h1><span className="page-sub">{sub}</span></div></header>
        <div className="page-empty">
          <FileText size={28} />
          <b>Sem itens para o PDF</b>
          <span>{canAdd ? 'Adicione os itens da proposta e o PDF fica pronto para o cliente.' : 'Esta revisão não tem itens.'}</span>
          <div>
            {canAdd && <button type="button" className="flow-btn primary" onClick={onAddItems}><Plus size={16} /> Adicionar itens</button>}
            <button type="button" className="flow-btn" onClick={onBack}>Voltar à proposta</button>
          </div>
        </div>
      </main>
    );
  }

  const canSend = p11 && canEdit && proposal.isLatest && ['draft', 'review', 'sent'].includes(proposal.status);
  const zoom = ZOOMS[zoomIndex];
  // 100% = a pagina inteira dentro da area de visualizacao (largura e altura); 125% a 200% ampliam a partir dai.
  const baseScale = Math.min(1.8, Math.max(0.5, Math.min((stageSize.width - 56) / PDF_PAGE_WIDTH, (stageSize.height - 56) / PDF_PAGE_HEIGHT)));
  const scale = baseScale * (zoom / 100);
  const current = pages[safeIndex];
  const setChoice = <K extends keyof PdfChoices>(key: K, value: PdfChoices[K]) => { setChoices((prev) => ({ ...prev, [key]: value })); setPageIndex(0); };

  const shareWhatsApp = () => {
    setShareOpen(false);
    openExternalUrl(`https://api.whatsapp.com/send?text=${encodeURIComponent(pdfDefaultMessage(proposal))}`);
    showNotice(`Abrindo o WhatsApp com a mensagem. Baixe o PDF e anexe ${fileName} na conversa.`);
  };
  const shareEmail = () => {
    setShareOpen(false);
    openExternalUrl(`mailto:?subject=${encodeURIComponent(`Proposta ${proposal.number} · Construtec`)}&body=${encodeURIComponent(`${pdfDefaultMessage(proposal)}\n\nO arquivo da proposta segue em anexo.`)}`);
    showNotice(`Abrindo o e-mail. Baixe o PDF e anexe ${fileName}.`);
  };
  const shareCopy = async () => {
    setShareOpen(false);
    try { await navigator.clipboard.writeText(pdfDefaultMessage(proposal)); showNotice('Mensagem copiada. Cole na conversa com o cliente.'); }
    catch { showNotice('Não foi possível copiar automaticamente.'); }
  };
  const sharePrint = () => { setShareOpen(false); void download(); };

  return (
    <main className="workspace-page pdf-page">
      {back}
      <header className="page-head">
        <div><span className="page-eyebrow">Proposta</span><h1>PDF da proposta</h1><span className="page-sub">{sub}</span></div>
        <div className="page-head-actions">
          <div className="share-wrap" ref={shareRef}>
            <button type="button" className="flow-btn" aria-haspopup="menu" aria-expanded={shareOpen} onClick={() => setShareOpen((v) => !v)}>
              <Share2 size={16} /> Compartilhar
            </button>
            {shareOpen && (
              <div className="share-menu" role="menu">
                <span className="share-menu-title">Compartilhar {fileName}</span>
                <button type="button" role="menuitem" onClick={shareWhatsApp}><MessageCircle size={16} /> WhatsApp</button>
                <button type="button" role="menuitem" onClick={shareEmail}><Mail size={16} /> E-mail</button>
                <button type="button" role="menuitem" onClick={() => void shareCopy()}><FileText size={16} /> Copiar mensagem</button>
                <button type="button" role="menuitem" onClick={sharePrint}><Download size={16} /> Salvar como PDF</button>
                <span className="share-menu-note">Compartilhar não muda a situação da proposta.</span>
              </div>
            )}
          </div>
          <button type="button" className="flow-btn" disabled={busy} onClick={() => void download()}>
            {busy ? <Loader2 size={16} className="spinning" /> : <Download size={16} />} {busy ? 'Baixando…' : 'Baixar PDF'}
          </button>
          {canSend && (
            <button type="button" className="flow-btn primary" onClick={() => { setShareOpen(false); setSendOpen(true); }}>
              <Send size={16} /> {proposal.status === 'sent' ? 'Reenviar ao cliente' : 'Enviar ao cliente'}
            </button>
          )}
        </div>
      </header>

      <div className="pdf-layout">
        <div className="pdf-thumbs" role="list" aria-label="Páginas do PDF">
          {pages.map((page, index) => (
            <button
              key={index}
              type="button"
              role="listitem"
              className={index === safeIndex ? 'current' : ''}
              aria-current={index === safeIndex ? 'page' : undefined}
              aria-label={`Página ${index + 1}, ${page.label}`}
              onClick={() => setPageIndex(index)}
            >
              <span className="pdf-thumb-box" style={{ width: THUMB_WIDTH, height: Math.round(PDF_PAGE_HEIGHT * (THUMB_WIDTH / PDF_PAGE_WIDTH)) }}>
                <span style={{ transform: `scale(${THUMB_WIDTH / PDF_PAGE_WIDTH})` }} dangerouslySetInnerHTML={{ __html: page.html }} />
              </span>
              <small>{index + 1} · {page.label}</small>
            </button>
          ))}
        </div>

        <section className="pdf-viewer" aria-label="Pré-visualização">
          <div className="pdf-viewer-bar">
            <b>Página {safeIndex + 1} de {pages.length} · {current?.label}</b>
            <button type="button" aria-label="Página anterior" disabled={safeIndex === 0} onClick={() => setPageIndex(safeIndex - 1)}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Próxima página" disabled={safeIndex >= pages.length - 1} onClick={() => setPageIndex(safeIndex + 1)}><ChevronRight size={16} /></button>
            <span className="grow" />
            <button type="button" aria-label="Diminuir o zoom" disabled={zoomIndex === 0} onClick={() => setZoomIndex(zoomIndex - 1)}><Minus size={16} /></button>
            <span className="pdf-zoom">{zoom}%</span>
            <button type="button" aria-label="Aumentar o zoom" disabled={zoomIndex >= ZOOMS.length - 1} onClick={() => setZoomIndex(zoomIndex + 1)}><Plus size={16} /></button>
          </div>
          <div className="pdf-stage" ref={stageRef}>
            {current && (
              <div className="pdf-page-wrap" style={{ width: Math.round(PDF_PAGE_WIDTH * scale), height: Math.round(PDF_PAGE_HEIGHT * scale) }}>
                <div className="pdf-page-scale" style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: current.html }} />
              </div>
            )}
          </div>
        </section>

        <aside className="pdf-options" aria-label="Opções do PDF">
          <fieldset>
            <legend>Modelo</legend>
            <div role="radiogroup" aria-label="Modelo do PDF">
              {([['completo', 'Completo', 'Cada item com quantidade e preço'], ['resumido', 'Resumido', 'Só o total de cada sistema']] as const).map(([value, title, text]) => (
                <button key={value} type="button" role="radio" aria-checked={choices.modelo === value} onClick={() => setChoice('modelo', value)}>
                  <span><b>{title}</b><small>{text}</small></span><i className="radio" />
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Incluir no PDF</legend>
            {([
              ['capa', 'Capa', 'Obra, cliente e valor total', false],
              ['condicoes', 'Condições comerciais', 'Pagamento, prazo e garantia', false],
              ['validade', 'Validade', proposal.validUntil ? `Até ${formatIsoDate(proposal.validUntil)}` : 'Sem validade definida', !proposal.validUntil],
            ] as const).map(([key, title, text, off]) => (
              <button key={key} type="button" role="switch" aria-checked={key === 'validade' ? eff.validade : choices[key]} disabled={off} onClick={() => setChoice(key, !choices[key])}>
                <span><b>{title}</b><small>{text}</small></span><i className="switch" />
              </button>
            ))}
          </fieldset>
          {p10 && (
            <div className="pdf-team">
              <div><b><Eye size={15} /> Só para a equipe</b><span>Não vai no PDF</span></div>
              <dl>
                <dt>Custo base</dt><dd>{brl.format(proposal.totals.baseCost ?? 0)}</dd>
                <dt>BDI</dt><dd>{proposal.bdiMultiplier.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ×</dd>
                <dt>Margem</dt><dd>{(proposal.totals.marginPercent ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</dd>
              </dl>
            </div>
          )}
          <p className="pdf-hint"><ShieldCheck size={16} /> O cliente vê só preços de venda. Custo, BDI e margem nunca entram no PDF.</p>
          {!canSend && (
            <p className="pdf-hint lock"><LockKeyhole size={16} /> {!p11
              ? 'Seu papel não permite enviar a proposta ao cliente. Baixe ou compartilhe o PDF; quem envia marca como Enviada.'
              : !canEdit ? 'Seu acesso é só de consulta: baixe ou compartilhe o PDF.'
                : !proposal.isLatest ? 'Só a revisão atual pode ser enviada.'
                  : 'Proposta já decidida pelo cliente: dá para baixar e compartilhar o PDF.'}</p>
          )}
        </aside>
      </div>

      {sendOpen && (
        <ProposalSendDrawer
          proposal={proposal}
          choices={eff}
          fetchDocument={fetchDocument}
          onClose={() => setSendOpen(false)}
          onSent={(updated) => { setSendOpen(false); onProposalUpdate(updated); onProposalTabsReload(); showNotice('Proposta marcada como enviada.'); onBack(); }}
          showNotice={showNotice}
        />
      )}
    </main>
  );
}
