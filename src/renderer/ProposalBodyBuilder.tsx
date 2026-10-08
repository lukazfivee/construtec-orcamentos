import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlignLeft, Check, CircleAlert, Eye, FileText, Heading, LayoutTemplate, List, Loader2, Mail, PenLine, Plus, RotateCcw, Sheet, Undo2 } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { getProposalFinancials } from '../shared/proposalFinancials';
import { BODY_LIMITS, BUILTIN_BODY_TEMPLATES, emptyBodyBlock, resolveBodyParts, type BodyBlock, type BodyBlockType, type BodyTemplate } from '../shared/proposalBody';
import { BODY_MODELS, findBodyModel, modelBodyBlocks, pendingPlaceholders } from '../shared/proposalBodyModels';
import { proposalApi } from './api';
import { ProposalBodyCard } from './ProposalBodyCard';
import {
  blockFromTemplate, canAddBlock, duplicateBlockAt, hasBlockType, insertBlockAt, moveBlock, removeBlockAt, templateFromBlock, updateBlockAt,
} from './proposalBodyEdit';
import { SaveBodyModel } from './SaveBodyModel';
import { useCompanyBodyModels } from './useCompanyBodyModels';
import { useProposalBody } from './useProposalBody';
import './ProposalBodyBuilder.css';

type Props = {
  proposal: ProposalDetail;
  editable: boolean;
  conditionsSlot: ReactNode;
  onUpdateProposal: (proposal: ProposalDetail) => void;
  onPreview: () => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const UNDO_MS = 10000;

// Linha entre dois blocos para inserir paragrafo, titulo, lista ou modelo exatamente ali.
export function InsertRow({ at, open, full, templates, blocks, onToggle, onAdd, onTemplate }: {
  at: number; open: boolean; full: boolean; templates: BodyTemplate[]; blocks: BodyBlock[];
  onToggle: () => void; onAdd: (type: BodyBlockType) => void; onTemplate: (id: string) => void;
}) {
  return (
    <div className={`body-insert${open ? ' is-open' : ''}`}>
      <button type="button" className="body-add" aria-expanded={open} disabled={full} onClick={onToggle} title={full ? `Limite de ${BODY_LIMITS.blocks} blocos` : undefined}>
        <Plus size={15} />{at === 0 ? 'Adicionar no início' : 'Adicionar aqui'}
      </button>
      {open && (
        <div className="body-insert-menu" role="group" aria-label="Tipo de bloco">
          <button type="button" className="body-btn" onClick={() => onAdd('paragrafo')}><AlignLeft size={16} />Parágrafo</button>
          <button type="button" className="body-btn" onClick={() => onAdd('titulo')}><Heading size={16} />Título de seção</button>
          <button type="button" className="body-btn" onClick={() => onAdd('lista')}><List size={16} />Lista</button>
          <button type="button" className="body-btn" onClick={() => onAdd('planilha')}><Sheet size={16} />Planilha própria</button>
          {!hasBlockType(blocks, 'carta') && <button type="button" className="body-btn" onClick={() => onAdd('carta')}><Mail size={16} />Carta de abertura</button>}
          {!hasBlockType(blocks, 'fechamento') && <button type="button" className="body-btn" onClick={() => onAdd('fechamento')}><PenLine size={16} />Fechamento e assinatura</button>}
          <select aria-label="Inserir modelo" value="" onChange={(event) => { if (event.currentTarget.value) onTemplate(event.currentTarget.value); }}>
            <option value="">Inserir modelo…</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// Montador do corpo da proposta: lista de blocos na ordem do documento, com a tabela de itens e as condicoes
// comerciais como blocos especiais (movem, mas a tabela nao sai e as condicoes so se desligam).
export function ProposalBodyBuilder({ proposal, editable, conditionsSlot, onUpdateProposal, onPreview, showNotice, setError }: Props) {
  const { draft, setDraft, dirty, state, flush, resetToDefault } = useProposalBody(proposal, editable, onUpdateProposal, setError);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [templates, setTemplates] = useState<BodyTemplate[]>(BUILTIN_BODY_TEMPLATES);
  const [undo, setUndo] = useState<{ block: BodyBlock; index: number } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const company = useCompanyBodyModels();
  const undoTimer = useRef<number | undefined>(undefined);
  const full = !canAddBlock(draft);

  useEffect(() => {
    let alive = true;
    proposalApi.bodyTemplates().then((result) => { if (alive) setTemplates(result.templates); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const focusBlock = (id: string) => window.requestAnimationFrame(() => {
    (document.getElementById(`body-text-${id}`) ?? document.getElementById(`body-title-${id}`))?.focus();
  });
  const addBlock = (block: BodyBlock, at: number) => {
    setDraft((current) => insertBlockAt(current, at, block));
    setOpenAt(null);
    focusBlock(block.id);
  };
  const remove = (index: number) => {
    const block = draft[index];
    setDraft((current) => removeBlockAt(current, index));
    setUndo({ block, index });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  };
  const undoRemove = () => {
    if (!undo) return;
    setDraft((current) => insertBlockAt(current, undo.index, undo.block));
    setUndo(null);
  };
  const saveTemplate = async (index: number, name: string): Promise<boolean> => {
    const input = templateFromBlock(draft[index], name);
    if (!input) return false;
    try {
      const result = await proposalApi.addBodyTemplate(input);
      setTemplates(result.templates);
      showNotice('Modelo salvo na biblioteca da empresa.');
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar o modelo.');
      return false;
    }
  };
  const dropTo = (to: number) => {
    if (dragFrom !== null) setDraft((current) => moveBlock(current, dragFrom, to));
    setDragFrom(null);
    setDropAt(null);
  };
  const preview = async () => { if (await flush()) onPreview(); };
  const applyModel = () => {
    const model = findBodyModel(pendingModel, company.models);
    setPendingModel(null);
    if (model) { setDraft(modelBodyBlocks(model, undefined, company.place)); showNotice(`Modelo aplicado: ${model.name}. Preencha o que está entre colchetes.`); }
  };
  const saveModel = async (name: string): Promise<boolean> => {
    if (!(await flush())) return false;
    try { company.setModels((await proposalApi.saveBodyModel(name, draft)).models); showNotice('Corpo salvo como modelo da empresa.'); return true; }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível salvar o modelo.'); return false; }
  };
  const reset = async () => { setConfirmReset(false); if (await resetToDefault()) showNotice('O documento voltou ao formato padrão.'); };

  const itemsSummary = `${proposal.items.length.toLocaleString('pt-BR')} ${proposal.items.length === 1 ? 'item' : 'itens'} · total ${brl.format(getProposalFinancials(proposal).finalValue)}. Itens e preços se editam na aba Itens; aqui você escolhe só onde a tabela aparece.`;
  const outline = useMemo(() => resolveBodyParts(proposal, draft), [proposal, draft]);
  const pending = useMemo(() => pendingPlaceholders(draft), [draft]);
  const status = state === 'saving' ? 'Salvando…' : state === 'error' ? 'Não foi possível salvar' : dirty ? 'Alterações não salvas' : proposal.bodyBlocks ? 'Salvo' : 'Formato padrão do documento';
  const StatusIcon = state === 'saving' ? Loader2 : state === 'error' ? CircleAlert : Check;

  return (
    <div className="history-region conditions-region body-builder">
      <div className="history-heading">
        <div><FileText size={18} /><span><b>Corpo da proposta</b><small>Monte o texto que o cliente lê, na ordem em que aparece no PDF, no Word e na página do cliente.</small></span></div>
        <div className="body-head-actions">
          <span className={`body-status ${state === 'error' ? 'is-error' : dirty || state === 'saving' ? 'is-dirty' : ''}`} role="status"><StatusIcon size={15} className={state === 'saving' ? 'spin' : undefined} />{status}</span>
          {dirty && state !== 'saving' && <button type="button" onClick={() => void flush()}>Salvar agora</button>}
          {editable && (
            <select className="body-model-select" aria-label="Aplicar modelo de proposta" value="" onChange={(event) => { if (event.currentTarget.value) setPendingModel(event.currentTarget.value); }}>
              <option value="">Aplicar modelo…</option>
              {BODY_MODELS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              {company.models.length > 0 && <optgroup label="Modelos da empresa">{company.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</optgroup>}
            </select>
          )}
          {editable && <SaveBodyModel existing={company.models.map((model) => model.name)} disabled={state === 'saving'} onSave={saveModel} />}
          <button type="button" onClick={() => void preview()}><Eye size={16} />Ver como ficará</button>
        </div>
      </div>

      {!proposal.bodyBlocks && editable && (
        <p className="body-banner">Esta proposta usa o documento no formato padrão. Os blocos abaixo mostram o que ele traz hoje; ao editar qualquer um, o corpo passa a ser o que você montar aqui.</p>
      )}
      {pendingModel && (
        <div className="body-banner body-confirm" role="alertdialog" aria-label="Aplicar modelo">
          <p><LayoutTemplate size={16} /> Aplicar o modelo <b>{findBodyModel(pendingModel, company.models)?.name}</b>? Todos os blocos atuais do corpo serão trocados pelos do modelo. {findBodyModel(pendingModel, company.models)?.description}</p>
          <span><button type="button" className="body-btn primary" onClick={applyModel}>Trocar o corpo pelo modelo</button><button type="button" className="body-btn" onClick={() => setPendingModel(null)}>Cancelar</button></span>
        </div>
      )}
      {!editable && <p className="body-banner">Esta revisão está fechada para edição. Crie uma revisão para alterar o corpo.</p>}

      <div className="body-layout">
        <section className="body-list" aria-label="Blocos do corpo da proposta">
          {editable && <InsertRow at={0} open={openAt === 0} full={full} templates={templates} blocks={draft} onToggle={() => setOpenAt(openAt === 0 ? null : 0)} onAdd={(type) => addBlock(emptyBodyBlock(type, undefined, company.place), 0)} onTemplate={(id) => { const t = templates.find((x) => x.id === id); if (t) addBlock(blockFromTemplate(t), 0); }} />}
          {draft.map((block, index) => (
            <div key={block.id} className="body-slot">
              <ProposalBodyCard
                block={block} index={index} total={draft.length} editable={editable} dragging={dragFrom === index} dropTarget={dragFrom !== null && dropAt === index && dragFrom !== index}
                itemsSummary={itemsSummary} conditionsSlot={conditionsSlot}
                onChange={(patch) => setDraft((current) => updateBlockAt(current, index, patch))}
                onMove={(delta) => setDraft((current) => moveBlock(current, index, index + delta))}
                onDuplicate={() => setDraft((current) => duplicateBlockAt(current, index))}
                onRemove={() => remove(index)}
                onSaveTemplate={(name) => saveTemplate(index, name)}
                onDragStart={() => setDragFrom(index)} onDragOver={() => setDropAt(index)} onDrop={() => dropTo(index)} onDragEnd={() => { setDragFrom(null); setDropAt(null); }}
              />
              {editable && <InsertRow at={index + 1} open={openAt === index + 1} full={full} templates={templates} blocks={draft} onToggle={() => setOpenAt(openAt === index + 1 ? null : index + 1)} onAdd={(type) => addBlock(emptyBodyBlock(type, undefined, company.place), index + 1)} onTemplate={(id) => { const t = templates.find((x) => x.id === id); if (t) addBlock(blockFromTemplate(t), index + 1); }} />}
            </div>
          ))}
          {full && <p className="body-note">O corpo chegou ao limite de {BODY_LIMITS.blocks} blocos.</p>}
        </section>

        <aside className="body-outline" aria-label="Ordem do documento">
          <b>Ordem do documento</b>
          <small>Como o cliente lê, com as variáveis já preenchidas.</small>
          <ol>
            {outline.map((part, index) => (
              <li key={index} className={`k-${part.kind}`}>
                {part.kind === 'heading' && <b>{part.text}</b>}
                {part.kind === 'paragraph' && <span>{part.lines[0]}</span>}
                {part.kind === 'planilha' && <span>Planilha: {part.rows.length} {part.rows.length === 1 ? 'linha' : 'linhas'} × {part.headers.length} {part.headers.length === 1 ? 'coluna' : 'colunas'}</span>}
                {part.kind === 'list' && <span>{part.items.length} {part.items.length === 1 ? 'tópico' : 'tópicos'}: {part.items[0]}</span>}
                {(part.kind === 'itens' || part.kind === 'condicoes') && <b>{part.title} <em>{part.kind === 'itens' ? 'tabela de itens' : 'condições'}</em></b>}
                {part.kind === 'carta' && <b>{part.title} <em>carta de abertura</em></b>}
                {part.kind === 'fechamento' && <b>Fechamento <em>{part.signer ? `assinatura de ${part.signer}` : 'assinatura'}</em></b>}
              </li>
            ))}
          </ol>
          {pending > 0 && <p className="body-note body-pending">{pending} {pending === 1 ? 'trecho entre [colchetes] ainda precisa ser preenchido' : 'trechos entre [colchetes] ainda precisam ser preenchidos'}.</p>}
          {proposal.bodyBlocks && editable && (confirmReset
            ? <p className="body-reset">O documento volta ao layout fixo e os blocos montados são descartados.
              <span><button type="button" className="body-btn danger" onClick={() => void reset()}>Descartar blocos</button><button type="button" className="body-btn" onClick={() => setConfirmReset(false)}>Cancelar</button></span></p>
            : <button type="button" className="body-link" onClick={() => setConfirmReset(true)}><RotateCcw size={15} />Voltar ao formato padrão</button>)}
        </aside>
      </div>

      {undo && (
        <div className="body-undo" role="status">
          <span>Bloco removido.</span>
          <button type="button" onClick={undoRemove}><Undo2 size={15} />Desfazer</button>
        </div>
      )}
    </div>
  );
}
