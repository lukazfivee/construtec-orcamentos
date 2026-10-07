import { useEffect, useRef, useState } from 'react';
import { Check, FileText, Trash2 } from 'lucide-react';
import { BUILTIN_BODY_TEMPLATES, emptyBodyBlock, legacyBodyBlocks, type BodyBlock, type BodyTemplate } from '../shared/proposalBody';
import { BODY_MODELS, findBodyModel, modelBodyBlocks } from '../shared/proposalBodyModels';
import { CompanyBodyModelsList } from './CompanyBodyModelsList';
import { useCompanyBodyModels } from './useCompanyBodyModels';
import { settingsApi } from './api';
import { InsertRow } from './ProposalBodyBuilder';
import { ProposalBodyCard } from './ProposalBodyCard';
import {
  blockFromTemplate, canAddBlock, duplicateBlockAt, insertBlockAt, moveBlock, removeBlockAt, templateFromBlock, updateBlockAt,
} from './proposalBodyEdit';
import { setUnsavedChanges } from './unsavedChanges';
import './ProposalBodyBuilder.css';

type Props = { isAdmin: boolean; loading: boolean; onNotice: (message: string) => void; onError: (message: string) => void };

// Padroes da empresa: corpo que toda proposta nova recebe e biblioteca de modelos de texto. Propostas que ja existem nao mudam.
export function CompanyDefaultBody({ isAdmin, loading, onNotice, onError }: Props) {
  const [saved, setSaved] = useState<BodyBlock[] | null>(null);
  const [draft, setDraft] = useState<BodyBlock[] | null>(null);
  const [templates, setTemplates] = useState<BodyTemplate[]>(BUILTIN_BODY_TEMPLATES);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const company = useCompanyBodyModels();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const off = loading || !isAdmin || busy;
  const dirty = ready && JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    let alive = true;
    Promise.all([settingsApi.defaultBody(), settingsApi.bodyTemplates()]).then(([body, list]) => {
      if (!alive) return;
      setSaved(body.blocks); setDraft(body.blocks); setTemplates(list.templates); setReady(true);
    }).catch((error) => errorRef.current(error instanceof Error ? error.message : 'Não foi possível carregar o corpo padrão.'));
    return () => { alive = false; };
  }, []);
  useEffect(() => { setUnsavedChanges('corpo-padrao', dirty); return () => setUnsavedChanges('corpo-padrao', false); }, [dirty]);

  const save = async () => {
    setBusy(true);
    try {
      const result = await settingsApi.saveDefaultBody(draft);
      setSaved(result.blocks); setDraft(result.blocks);
      onNotice(result.blocks ? 'Corpo padrão salvo. Vale para as próximas propostas.' : 'Corpo padrão removido. As próximas propostas usam o formato padrão.');
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível salvar o corpo padrão.'); }
    finally { setBusy(false); }
  };
  const change = (next: (blocks: BodyBlock[]) => BodyBlock[]) => setDraft((current) => (current ? next(current) : current));
  const add = (block: BodyBlock, at: number) => { change((blocks) => insertBlockAt(blocks, at, block)); setOpenAt(null); };
  const addTemplate = (id: string, at: number) => { const template = templates.find((item) => item.id === id); if (template) add(blockFromTemplate(template), at); };
  const removeTemplate = async (id: string) => {
    setBusy(true);
    try { setTemplates((await settingsApi.saveBodyTemplates(templates.filter((template) => template.id !== id))).templates); onNotice('Modelo removido da biblioteca.'); }
    catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível remover o modelo.'); }
    finally { setBusy(false); }
  };
  const saveAsTemplate = async (index: number, name: string): Promise<boolean> => {
    const input = draft ? templateFromBlock(draft[index], name) : null;
    if (!input) return false;
    try {
      const id = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      setTemplates((await settingsApi.saveBodyTemplates([...templates, { ...input, id }])).templates);
      onNotice('Modelo salvo na biblioteca da empresa.');
      return true;
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível salvar o modelo.'); return false; }
  };
  const row = (at: number) => draft && (
    <InsertRow
      at={at} open={openAt === at} full={!canAddBlock(draft)} templates={templates} blocks={draft}
      onToggle={() => setOpenAt(openAt === at ? null : at)} onAdd={(type) => add(emptyBodyBlock(type, undefined, company.place), at)} onTemplate={(id) => addTemplate(id, at)}
    />
  );

  return (
    <div className="od-card pad od-col body-builder body-defaults">
      <span className="od-grow"><b>Corpo padrão de novas propostas</b><span>Os blocos que toda proposta nova recebe; cada uma pode mudar depois</span></span>
      {!draft ? (
        <>
          <p className="body-note">Sem corpo padrão: as propostas novas usam o documento no formato padrão.</p>
          <div className="body-defaults-start">
            <button type="button" className="od-btn s" disabled={off} onClick={() => setDraft(legacyBodyBlocks(''))}><FileText size={17} />Definir corpo padrão</button>
            <select className="body-model-select" aria-label="Começar de um modelo de proposta" value="" disabled={off} onChange={(event) => { const model = findBodyModel(event.currentTarget.value, company.models); if (model) setDraft(modelBodyBlocks(model, undefined, company.place)); }}>
              <option value="">Começar de um modelo…</option>
              {BODY_MODELS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              {company.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
          </div>
        </>
      ) : (
        <div className="body-list">
          {isAdmin && row(0)}
          {draft.map((block, index) => (
            <div key={block.id} className="body-slot">
              <ProposalBodyCard
                block={block} index={index} total={draft.length} editable={!off} dragging={false} dropTarget={false}
                itemsSummary="A tabela de itens de cada proposta entra aqui, com os preços de venda."
                conditionsSlot={<p className="body-note">Validade, prazo, pagamento e garantia são preenchidos em cada proposta.</p>}
                onChange={(patch) => change((blocks) => updateBlockAt(blocks, index, patch))}
                onMove={(delta) => change((blocks) => moveBlock(blocks, index, index + delta))}
                onDuplicate={() => change((blocks) => duplicateBlockAt(blocks, index))}
                onRemove={() => change((blocks) => removeBlockAt(blocks, index))}
                onSaveTemplate={(name) => saveAsTemplate(index, name)}
                onDragStart={() => undefined} onDragOver={() => undefined} onDrop={() => undefined} onDragEnd={() => undefined}
              />
              {isAdmin && row(index + 1)}
            </div>
          ))}
          <button type="button" className="body-link" disabled={off} onClick={() => setDraft(null)}>Remover o corpo padrão</button>
        </div>
      )}
      <div className="body-defaults-save">
        <span>{dirty ? 'Alterações ainda não salvas · valem para as próximas propostas' : 'Propostas já criadas mantêm o corpo delas'}</span>
        <button type="button" className="od-btn s" disabled={!dirty || off} onClick={() => setDraft(saved)}>Descartar</button>
        <button type="button" className="od-btn p" disabled={!dirty || off} onClick={() => void save()}><Check size={17} />{busy ? 'Salvando…' : 'Salvar corpo padrão'}</button>
      </div>
      <CompanyBodyModelsList models={company.models} disabled={off} onChange={company.setModels} onNotice={onNotice} onError={onError} />
      <span className="od-lbl plain">Modelos de texto da empresa</span>
      <ul className="body-templates">
        {templates.map((template) => (
          <li key={template.id}>
            <span><b>{template.name}</b><small>{template.type === 'lista' ? 'Lista' : 'Parágrafo'} · {template.text.length.toLocaleString('pt-BR')} caracteres</small></span>
            <button type="button" className="body-icon danger" aria-label={`Remover o modelo ${template.name}`} disabled={off} onClick={() => void removeTemplate(template.id)}><Trash2 size={16} /></button>
          </li>
        ))}
        {templates.length === 0 && <li className="body-note">Nenhum modelo. Salve um parágrafo como modelo na aba Corpo e condições.</li>}
      </ul>
    </div>
  );
}
