// Operacoes puras sobre a lista de blocos do corpo da proposta (o editor so chama estas funcoes).
import { BODY_LIMITS, newBodyId, type BodyBlock, type BodyTemplate } from '../shared/proposalBody';

export const canAddBlock = (blocks: BodyBlock[]) => blocks.length < BODY_LIMITS.blocks;
// A tabela de itens nunca sai do corpo; as condicoes so se desligam.
export const canRemoveBlock = (block: BodyBlock) => block.type !== 'itens' && block.type !== 'condicoes';
export const canDisableBlock = (block: BodyBlock) => block.type !== 'itens';

export const insertBlockAt = (blocks: BodyBlock[], at: number, block: BodyBlock): BodyBlock[] => {
  if (!canAddBlock(blocks)) return blocks;
  const next = [...blocks];
  next.splice(Math.min(Math.max(at, 0), next.length), 0, block);
  return next;
};

export const moveBlock = (blocks: BodyBlock[], from: number, to: number): BodyBlock[] => {
  if (from === to || from < 0 || from >= blocks.length || to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks];
  const [block] = next.splice(from, 1);
  next.splice(to, 0, block);
  return next;
};

export const removeBlockAt = (blocks: BodyBlock[], index: number): BodyBlock[] =>
  blocks[index] && canRemoveBlock(blocks[index]) ? blocks.filter((_, at) => at !== index) : blocks;

// So paragrafo, titulo e lista se duplicam: a tabela de itens e as condicoes existem uma vez so.
export const duplicateBlockAt = (blocks: BodyBlock[], index: number): BodyBlock[] => {
  const block = blocks[index];
  if (!block || !canRemoveBlock(block)) return blocks;
  return insertBlockAt(blocks, index + 1, { ...block, id: newBodyId() });
};

export const updateBlockAt = (blocks: BodyBlock[], index: number, patch: Partial<Omit<BodyBlock, 'id' | 'type'>>): BodyBlock[] =>
  blocks.map((block, at) => (at === index ? { ...block, ...patch } : block));

export const blockFromTemplate = (template: BodyTemplate): BodyBlock => ({
  id: newBodyId(), type: template.type, enabled: true, ...(template.title ? { title: template.title } : {}), text: template.text,
});

export const templateFromBlock = (block: BodyBlock, name: string): Omit<BodyTemplate, 'id'> | null => {
  if (block.type !== 'paragrafo' && block.type !== 'lista') return null;
  const text = (block.text ?? '').trim();
  const cleanName = name.trim();
  if (!text || !cleanName) return null;
  return { name: cleanName.slice(0, BODY_LIMITS.templateName), type: block.type, ...(block.title?.trim() ? { title: block.title.trim() } : {}), text };
};

export const BLOCK_LABELS: Record<BodyBlock['type'], string> = {
  titulo: 'Título de seção', paragrafo: 'Parágrafo', lista: 'Lista', itens: 'Tabela de itens', condicoes: 'Condições comerciais',
};
