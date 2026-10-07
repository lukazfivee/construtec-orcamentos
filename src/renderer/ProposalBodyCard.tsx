import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlignLeft, Bookmark, ChevronDown, ChevronUp, Copy, GripVertical, Heading, List, Mail, PenLine, ReceiptText, Table2, Trash2, type LucideIcon,
} from 'lucide-react';
import { BODY_LIMITS, BODY_VARIABLES, CONDITIONS_DEFAULT_TITLE, ITEMS_DEFAULT_TITLE, LETTER_TITLE_DEFAULT, type BodyBlock } from '../shared/proposalBody';
import { ProposalBodyFields } from './ProposalBodyFields';
import { BLOCK_LABELS, canDisableBlock, canDuplicateBlock, canRemoveBlock } from './proposalBodyEdit';

const ICONS: Record<BodyBlock['type'], LucideIcon> = { titulo: Heading, paragrafo: AlignLeft, lista: List, itens: Table2, condicoes: ReceiptText, carta: Mail, fechamento: PenLine };

export type ProposalBodyCardProps = {
  block: BodyBlock;
  index: number;
  total: number;
  editable: boolean;
  dragging: boolean;
  dropTarget: boolean;
  itemsSummary: string;
  conditionsSlot?: ReactNode;
  onChange: (patch: Partial<Omit<BodyBlock, 'id' | 'type'>>) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSaveTemplate: (name: string) => Promise<boolean>;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
};

// Campo de texto que cresce com o conteudo: o cartao nunca ganha rolagem propria.
function GrowingText({ id, value, disabled, placeholder, onChange }: {
  id: string; value: string; disabled: boolean; placeholder: string; onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} id={id} rows={3} value={value} maxLength={BODY_LIMITS.text} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.currentTarget.value)} />;
}

export function ProposalBodyCard(props: ProposalBodyCardProps) {
  const { block, index, total, editable, dragging, dropTarget, itemsSummary, conditionsSlot, onChange } = props;
  const Icon = ICONS[block.type];
  const isText = block.type === 'paragrafo' || block.type === 'lista' || block.type === 'fechamento';
  const canSub = block.type === 'titulo' || block.type === 'paragrafo' || block.type === 'lista';
  const textId = `body-text-${block.id}`;
  const length = (block.text ?? '').length;
  const [naming, setNaming] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const off = !block.enabled;

  const insertVariable = (key: string) => {
    const element = document.getElementById(textId) as HTMLTextAreaElement | null;
    const text = block.text ?? '';
    const token = `{{${key}}}`;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${token}${text.slice(end)}`.slice(0, BODY_LIMITS.text);
    onChange({ text: next });
    window.requestAnimationFrame(() => { element?.focus(); element?.setSelectionRange(start + token.length, start + token.length); });
  };

  const saveTemplate = async () => {
    setSavingTemplate(true);
    const saved = await props.onSaveTemplate(templateName);
    setSavingTemplate(false);
    if (saved) { setNaming(false); setTemplateName(''); }
  };

  const titleLabel = block.type === 'titulo' ? 'Texto do título' : block.type === 'carta' ? 'Título do documento' : 'Título da seção (opcional)';
  const titlePlaceholder = block.type === 'itens' ? ITEMS_DEFAULT_TITLE : block.type === 'condicoes' ? CONDITIONS_DEFAULT_TITLE : block.type === 'carta' ? LETTER_TITLE_DEFAULT : 'Ex.: Escopo dos serviços';

  return (
    <article
      className={`body-card${off ? ' is-off' : ''}${dragging ? ' is-dragging' : ''}${dropTarget ? ' is-drop' : ''}${block.type === 'itens' || block.type === 'condicoes' ? ' is-special' : ''}`}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; props.onDragOver(); }}
      onDrop={(event) => { event.preventDefault(); props.onDrop(); }}
      aria-label={`${BLOCK_LABELS[block.type]} ${index + 1} de ${total}`}
    >
      <header className="body-card-head">
        {editable && (
          <span
            className="body-grip" draggable aria-hidden="true" title="Arraste para mudar a ordem"
            onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', block.id); props.onDragStart(); }}
            onDragEnd={props.onDragEnd}
          ><GripVertical size={16} /></span>
        )}
        <span className="body-kind"><Icon size={16} /><b>{BLOCK_LABELS[block.type]}</b><small>{index + 1}</small></span>
        <span className="body-card-actions">
          {canDisableBlock(block) && (
            <button type="button" role="switch" aria-checked={block.enabled} className="body-switch" disabled={!editable} onClick={() => onChange({ enabled: !block.enabled })}>
              <span>{block.enabled ? 'Ligado' : 'Desligado'}</span><i />
            </button>
          )}
          <button type="button" className="body-icon" aria-label="Subir bloco" title="Subir" disabled={!editable || index === 0} onClick={() => props.onMove(-1)}><ChevronUp size={16} /></button>
          <button type="button" className="body-icon" aria-label="Descer bloco" title="Descer" disabled={!editable || index === total - 1} onClick={() => props.onMove(1)}><ChevronDown size={16} /></button>
          {canDuplicateBlock(block) && <button type="button" className="body-icon" aria-label="Duplicar bloco" title="Duplicar" disabled={!editable} onClick={props.onDuplicate}><Copy size={16} /></button>}
          {canRemoveBlock(block) && <button type="button" className="body-icon danger" aria-label="Remover bloco" title="Remover" disabled={!editable} onClick={props.onRemove}><Trash2 size={16} /></button>}
        </span>
      </header>

      <div className="body-card-body">
        <label className="body-field">{titleLabel}
          <input id={`body-title-${block.id}`} type="text" value={block.title ?? ''} maxLength={BODY_LIMITS.title} placeholder={titlePlaceholder} disabled={!editable} onChange={(event) => onChange({ title: event.currentTarget.value })} />
        </label>
        {canSub && (
          <label className="body-check">
            <input type="checkbox" checked={Boolean(block.sub)} disabled={!editable} onChange={(event) => onChange({ sub: event.currentTarget.checked })} />
            Subtítulo (nível abaixo do título da seção anterior)
          </label>
        )}
        {block.type === 'itens' && (
          <label className="body-field">Título da planilha (opcional)
            <input type="text" value={block.text ?? ''} maxLength={BODY_LIMITS.caption} placeholder="Ex.: Planilha de mão de obra - {{obra}}" disabled={!editable} onChange={(event) => onChange({ text: event.currentTarget.value })} />
          </label>
        )}
        <ProposalBodyFields block={block} editable={editable} onChange={onChange} />

        {isText && (
          <>
            <label className="body-field" htmlFor={textId}>{block.type === 'lista' ? 'Itens da lista (um por linha, pode começar com -)' : block.type === 'fechamento' ? 'Texto de fechamento' : 'Texto'}</label>
            <GrowingText
              id={textId} value={block.text ?? ''} disabled={!editable}
              placeholder={block.type === 'lista' ? '- Primeiro item\n- Segundo item' : 'Escreva o parágrafo. Linha em branco separa parágrafos.'}
              onChange={(value) => onChange({ text: value })}
            />
            <div className="body-foot">
              <span className={`body-count${length > BODY_LIMITS.text * 0.9 ? ' warn' : ''}`}>{length.toLocaleString('pt-BR')} / {BODY_LIMITS.text.toLocaleString('pt-BR')} caracteres</span>
              {editable && (
                <span className="body-tools">
                  <select aria-label="Inserir variável" value="" onChange={(event) => { if (event.currentTarget.value) insertVariable(event.currentTarget.value); }}>
                    <option value="">Inserir variável</option>
                    {BODY_VARIABLES.map((variable) => <option key={variable.key} value={variable.key}>{variable.label} · {`{{${variable.key}}}`}</option>)}
                  </select>
                  {block.type !== 'fechamento' && <button type="button" className="body-link" disabled={!(block.text ?? '').trim()} onClick={() => setNaming((value) => !value)}><Bookmark size={15} />Salvar como modelo</button>}
                </span>
              )}
            </div>
            {naming && (
              <div className="body-naming">
                <input type="text" value={templateName} maxLength={BODY_LIMITS.templateName} placeholder="Nome do modelo" aria-label="Nome do modelo" onChange={(event) => setTemplateName(event.currentTarget.value)} />
                <button type="button" className="body-btn primary" disabled={!templateName.trim() || savingTemplate} onClick={() => void saveTemplate()}>{savingTemplate ? 'Salvando…' : 'Salvar modelo'}</button>
                <button type="button" className="body-btn" onClick={() => setNaming(false)}>Cancelar</button>
              </div>
            )}
          </>
        )}

        {block.type === 'itens' && <p className="body-note">{itemsSummary}</p>}
        {block.type === 'condicoes' && (off
          ? <p className="body-note">Desligado: validade, prazo, pagamento e garantia não saem no documento.</p>
          : conditionsSlot)}
      </div>
    </article>
  );
}
