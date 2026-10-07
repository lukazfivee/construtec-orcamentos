// Corpo da proposta: blocos ordenados que o usuario monta (titulo, paragrafo, lista) mais dois blocos especiais,
// a tabela de itens (preco de venda) e as condicoes comerciais. Este modulo e a fonte unica para o editor, o
// servidor e todos os documentos (PDF, Word, pagina do cliente): limites, limpeza do texto, variaveis e ordem.
// So conteudo comercial: custo, BDI e margem nunca entram aqui, nem como variavel.
import type { ProposalDetail } from './contracts';
import { getProposalFinancials } from './proposalFinancials';

export type BodyBlockType = 'titulo' | 'paragrafo' | 'lista' | 'itens' | 'condicoes';
export type BodyBlock = { id: string; type: BodyBlockType; title?: string; text?: string; enabled: boolean };
export type BodyTemplate = { id: string; name: string; type: 'paragrafo' | 'lista'; title?: string; text: string; builtin?: boolean };

export const BODY_LIMITS = { blocks: 60, text: 5000, title: 120, templateName: 80, templates: 40 } as const;
export const BODY_BLOCK_TYPES: readonly BodyBlockType[] = ['titulo', 'paragrafo', 'lista', 'itens', 'condicoes'];
export const ITEMS_DEFAULT_TITLE = 'Composição e precificação';
export const CONDITIONS_DEFAULT_TITLE = 'Condições comerciais';

export const BODY_VARIABLES = [
  { key: 'cliente', label: 'Cliente' }, { key: 'obra', label: 'Obra' }, { key: 'numero', label: 'Número da proposta' },
  { key: 'revisao', label: 'Revisão' }, { key: 'valor_total', label: 'Valor total' }, { key: 'validade', label: 'Validade' },
  { key: 'responsavel', label: 'Responsável' },
] as const;
export type BodyVariableKey = typeof BODY_VARIABLES[number]['key'];
export type BodyVariables = Record<BodyVariableKey, string>;

export const DEFAULT_LEAD = 'Prezados Senhores,\nApresentamos nossa proposta técnica e comercial para fornecimento de equipamentos, materiais e execução dos serviços descritos a seguir.';
export const DEFAULT_PRESENTATION = 'A CONSTRUTEC atua no desenvolvimento de soluções de engenharia, projetos, automação, elétrica, combate a incêndio e infraestrutura tecnológica. Apresentamos nossa proposta técnica e comercial para atendimento ao escopo descrito a seguir.';

export const newBodyId = (): string => {
  const random = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  return random ? random.call(globalThis.crypto) : `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

// Sem caracteres de controle nem de formatacao (inclui U+202E e zero-width). Texto longo aceita quebra de linha e tab.
export const cleanBodyText = (value: string, multiline: boolean): string => {
  const lines = value.replace(/\r\n?/g, '\n');
  const unified = multiline ? lines : lines.replace(/[\t\n]/g, ' ');
  const cleaned = [...unified].filter((char) => (multiline && (char === '\n' || char === '\t')) || !/[\p{Cf}\p{Cc}]/u.test(char)).join('');
  return multiline ? cleaned.replace(/[ \t]+\n/g, '\n').trim() : cleaned.replace(/\s+/g, ' ').trim();
};

export const normalizeBodyBlock = (block: BodyBlock): BodyBlock => {
  const title = cleanBodyText(block.title ?? '', false);
  const keepsText = block.type === 'paragrafo' || block.type === 'lista';
  return {
    id: block.id, type: block.type, enabled: block.type === 'itens' ? true : block.enabled,
    ...(title ? { title } : {}),
    ...(keepsText ? { text: cleanBodyText(block.text ?? '', true) } : {}),
  };
};
export const normalizeBodyBlocks = (blocks: BodyBlock[]): BodyBlock[] => blocks.map(normalizeBodyBlock);

// Regras de estrutura (o limite de tamanho de cada campo e do zod no servidor): uma tabela de itens e um bloco de condicoes.
export const bodyBlocksError = (blocks: BodyBlock[]): string | null => {
  if (blocks.length > BODY_LIMITS.blocks) return `O corpo aceita até ${BODY_LIMITS.blocks} blocos.`;
  if (blocks.filter((block) => block.type === 'itens').length !== 1) return 'A tabela de itens precisa existir uma vez no corpo.';
  if (blocks.filter((block) => block.type === 'condicoes').length !== 1) return 'As condições comerciais precisam existir uma vez no corpo.';
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) return 'Blocos com identificador repetido.';
  return null;
};

const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// valor_total e o preco de venda final (com impostos); nenhuma variavel le custo, BDI ou margem.
export const bodyVariables = (proposal: ProposalDetail): BodyVariables => ({
  cliente: proposal.clientName || '',
  obra: proposal.workName || '',
  numero: proposal.number,
  revisao: String(proposal.revision).padStart(2, '0'),
  valor_total: brl.format(getProposalFinancials(proposal).finalValue),
  validade: proposal.validUntil ? dateFmt.format(new Date(`${proposal.validUntil.slice(0, 10)}T00:00:00Z`)) : 'a definir',
  responsavel: proposal.responsibleName || '',
});

// Uma passada so: o valor de uma variavel nunca e reinterpretado como outra variavel.
export const resolveBodyText = (text: string, variables: BodyVariables): string =>
  text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => variables[key.toLowerCase() as BodyVariableKey] ?? match);

export type BodyPart =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'itens'; title: string }
  | { kind: 'condicoes'; title: string };

export const bodyParagraphs = (text: string): string[][] =>
  text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

export const bodyListItems = (text: string): string[] =>
  text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim().replace(/^[-*•]\s+/, '').trim()).filter(Boolean);

// Blocos ligados, na ordem escolhida, ja com as variaveis trocadas. Blocos vazios somem.
export const resolveBodyParts = (proposal: ProposalDetail, blocks: BodyBlock[]): BodyPart[] => {
  const variables = bodyVariables(proposal);
  const fill = (text: string | undefined) => resolveBodyText(text ?? '', variables);
  const parts: BodyPart[] = [];
  for (const block of blocks) {
    if (!block.enabled && block.type !== 'itens') continue;
    const title = fill(block.title).trim();
    if (block.type === 'itens') parts.push({ kind: 'itens', title: title || ITEMS_DEFAULT_TITLE });
    else if (block.type === 'condicoes') parts.push({ kind: 'condicoes', title: title || CONDITIONS_DEFAULT_TITLE });
    else if (block.type === 'titulo') { if (title) parts.push({ kind: 'heading', text: title }); }
    else {
      if (title) parts.push({ kind: 'heading', text: title });
      const text = fill(block.text);
      if (block.type === 'lista') { const items = bodyListItems(text); if (items.length) parts.push({ kind: 'list', items }); }
      else for (const lines of bodyParagraphs(text)) parts.push({ kind: 'paragraph', lines });
    }
  }
  return parts;
};

const meaningfulScope = (scope: string) => { const value = scope.trim(); return value && value.toLowerCase() !== 'a definir' ? value : ''; };

// O que o documento antigo (sem corpo montado) mostra, em blocos editaveis: e daqui que o editor parte.
export const legacyBodyBlocks = (scopeText: string): BodyBlock[] => {
  const scope = meaningfulScope(scopeText);
  return [
    { id: 'legado-abertura', type: 'paragrafo', text: DEFAULT_LEAD, enabled: true },
    { id: 'legado-apresentacao', type: 'paragrafo', title: 'Apresentação', text: DEFAULT_PRESENTATION, enabled: true },
    ...(scope ? [{ id: 'legado-escopo', type: 'paragrafo' as const, title: 'Escopo', text: scope, enabled: true }] : []),
    { id: 'legado-itens', type: 'itens', title: ITEMS_DEFAULT_TITLE, enabled: true },
    { id: 'legado-condicoes', type: 'condicoes', title: CONDITIONS_DEFAULT_TITLE, enabled: true },
  ];
};

// Corpo padrao da empresa aplicado a uma proposta nova: ids novos e o escopo digitado na criacao antes da tabela de itens.
export const seedBodyBlocks = (defaults: BodyBlock[] | null, scopeText: string): BodyBlock[] | null => {
  if (!defaults) return null;
  const scope = meaningfulScope(scopeText);
  const blocks = defaults.map((block) => ({ ...block, id: newBodyId() }));
  if (!scope) return blocks;
  const at = blocks.findIndex((block) => block.type === 'itens');
  blocks.splice(Math.max(0, at), 0, { id: newBodyId(), type: 'paragrafo', title: 'Escopo', text: scope, enabled: true });
  return blocks;
};

// Forma canonica do que o cliente leu (para o hash do aceite): so blocos ligados, sem ids.
export const bodyFingerprintSource = (blocks: BodyBlock[]) =>
  normalizeBodyBlocks(blocks).filter((block) => block.enabled).map((block) => [block.type, block.title ?? '', block.text ?? '']);

export const emptyBodyBlock = (type: 'titulo' | 'paragrafo' | 'lista'): BodyBlock =>
  ({ id: newBodyId(), type, enabled: true, ...(type === 'titulo' ? { title: '' } : { text: '' }) });

export const BUILTIN_BODY_TEMPLATES: BodyTemplate[] = [
  { id: 'modelo-apresentacao', name: 'Apresentação', type: 'paragrafo', title: 'Apresentação', text: DEFAULT_PRESENTATION, builtin: true },
  {
    id: 'modelo-escopo', name: 'Escopo dos serviços', type: 'lista', title: 'Escopo dos serviços', builtin: true,
    text: '- Fornecimento dos materiais e equipamentos relacionados na tabela de itens.\n- Instalação, configuração e testes de funcionamento.\n- Mão de obra técnica especializada e supervisão dos serviços.\n- Entrega do local limpo e organizado, com orientação de uso.',
  },
  {
    id: 'modelo-metodologia', name: 'Metodologia', type: 'paragrafo', title: 'Metodologia de execução', builtin: true,
    text: 'Os serviços na obra {{obra}} serão executados em etapas: levantamento em campo, planejamento e mobilização, execução, testes e comissionamento, entrega e orientação de uso.\n\nCada etapa é validada com o responsável da {{cliente}} antes de seguir para a próxima.',
  },
  {
    id: 'modelo-exclusoes', name: 'Exclusões', type: 'lista', title: 'Não estão incluídos', builtin: true,
    text: '- Obras civis, abertura e fechamento de alvenaria, salvo quando descritas na tabela de itens.\n- Taxas, licenças e aprovações em órgãos públicos.\n- Serviços e equipamentos não listados nesta proposta.\n- Pontos de energia e infraestrutura de terceiros.',
  },
  {
    id: 'modelo-condicoes-gerais', name: 'Condições gerais', type: 'paragrafo', title: 'Condições gerais', builtin: true,
    text: 'O valor total desta proposta é {{valor_total}}, válido até {{validade}}. Alterações de escopo solicitadas após o aceite serão orçadas à parte e só executadas mediante aprovação por escrito.\n\nO acesso ao local e a liberação das áreas de trabalho são de responsabilidade do contratante.',
  },
  {
    id: 'modelo-garantia', name: 'Garantia e suporte', type: 'paragrafo', title: 'Garantia e suporte', builtin: true,
    text: 'Os serviços executados têm garantia contra defeitos de instalação, conforme as condições comerciais desta proposta. Os equipamentos seguem a garantia do fabricante.\n\nPara qualquer ocorrência, o responsável {{responsavel}} direciona o atendimento técnico.',
  },
];
