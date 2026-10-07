// Corpo da proposta: blocos ordenados que o usuario monta (titulo, paragrafo, lista) mais dois blocos especiais,
// a tabela de itens (preco de venda) e as condicoes comerciais. Este modulo e a fonte unica para o editor, o
// servidor e todos os documentos (PDF, Word, pagina do cliente): limites, limpeza do texto, variaveis e ordem.
// So conteudo comercial: custo, BDI e margem nunca entram aqui, nem como variavel.
import type { ProposalDetail } from './contracts';
import { getProposalFinancials } from './proposalFinancials';

export type BodyBlockType = 'titulo' | 'paragrafo' | 'lista' | 'itens' | 'condicoes' | 'carta' | 'fechamento';
// Campos de uma linha da carta de abertura (carta) e da assinatura (fechamento); aceitam variaveis.
export const LETTER_FIELDS = ['place', 'date', 'recipient', 'attention', 'department', 'reference', 'greeting', 'intro'] as const;
export const SIGNATURE_FIELDS = ['signer', 'role'] as const;
export type BodyFieldKey = typeof LETTER_FIELDS[number] | typeof SIGNATURE_FIELDS[number];
export type BodyFields = Partial<Record<BodyFieldKey, string>>;
// sub: titulo de segundo nivel (1.1). numbered (so na carta): numera os titulos do documento. fields: carta e fechamento.
// Em "itens", text e o titulo da planilha; em "fechamento", text e o paragrafo final.
export type BodyBlock = { id: string; type: BodyBlockType; title?: string; text?: string; enabled: boolean; sub?: boolean; numbered?: boolean; fields?: BodyFields };
export type BodyTemplate = { id: string; name: string; type: 'paragrafo' | 'lista'; title?: string; text: string; builtin?: boolean };

export const BODY_LIMITS = { blocks: 60, text: 5000, title: 120, templateName: 80, templates: 40, field: 600, caption: 200 } as const;
export const BODY_BLOCK_TYPES: readonly BodyBlockType[] = ['titulo', 'paragrafo', 'lista', 'itens', 'condicoes', 'carta', 'fechamento'];
export const ITEMS_DEFAULT_TITLE = 'Composição e precificação';
export const CONDITIONS_DEFAULT_TITLE = 'Condições comerciais';

export const BODY_VARIABLES = [
  { key: 'cliente', label: 'Cliente' }, { key: 'obra', label: 'Obra' }, { key: 'numero', label: 'Número da proposta' },
  { key: 'revisao', label: 'Revisão' }, { key: 'valor_total', label: 'Valor total' }, { key: 'validade', label: 'Validade' },
  { key: 'responsavel', label: 'Responsável' }, { key: 'escopo', label: 'Descrição do serviço (escopo da proposta)' },
  { key: 'contato', label: 'Contato do cliente (nome e cargo)' }, { key: 'setor_contato', label: 'Setor do contato do cliente' },
  { key: 'email_contato', label: 'E-mail do contato do cliente' }, { key: 'telefone_contato', label: 'Telefone do contato do cliente' },
] as const;
export type BodyVariableKey = typeof BODY_VARIABLES[number]['key'];
export type BodyVariables = Record<BodyVariableKey, string>;

// Local que abre a carta quando ninguem escolheu outro (sede da Construtec); a empresa muda em Configuracoes.
export const DEFAULT_LETTER_PLACE = 'Salvador / BA';

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

const FIELD_KEYS: Partial<Record<BodyBlockType, readonly BodyFieldKey[]>> = { carta: LETTER_FIELDS, fechamento: SIGNATURE_FIELDS };

export const normalizeBodyBlock = (block: BodyBlock): BodyBlock => {
  const title = cleanBodyText(block.title ?? '', false);
  const keepsText = block.type === 'paragrafo' || block.type === 'lista' || block.type === 'fechamento';
  const caption = block.type === 'itens' ? cleanBodyText(block.text ?? '', false).slice(0, BODY_LIMITS.caption).trim() : '';
  const fieldKeys = FIELD_KEYS[block.type];
  const fields: BodyFields = {};
  for (const key of fieldKeys ?? []) if (typeof block.fields?.[key] === 'string') fields[key] = cleanBodyText(block.fields[key] ?? '', false);
  return {
    id: block.id, type: block.type, enabled: block.type === 'itens' ? true : block.enabled,
    ...(title ? { title } : {}),
    ...(keepsText ? { text: cleanBodyText(block.text ?? '', true) } : {}),
    ...(caption ? { text: caption } : {}),
    ...(block.sub && ['titulo', 'paragrafo', 'lista'].includes(block.type) ? { sub: true } : {}),
    ...(block.numbered && block.type === 'carta' ? { numbered: true } : {}),
    ...(fieldKeys ? { fields } : {}),
  };
};
export const normalizeBodyBlocks = (blocks: BodyBlock[]): BodyBlock[] => blocks.map(normalizeBodyBlock);

// Regras de estrutura (o limite de tamanho de cada campo e do zod no servidor): uma tabela de itens e um bloco de condicoes.
export const bodyBlocksError = (blocks: BodyBlock[]): string | null => {
  if (blocks.length > BODY_LIMITS.blocks) return `O corpo aceita até ${BODY_LIMITS.blocks} blocos.`;
  if (blocks.filter((block) => block.type === 'itens').length !== 1) return 'A tabela de itens precisa existir uma vez no corpo.';
  if (blocks.filter((block) => block.type === 'condicoes').length !== 1) return 'As condições comerciais precisam existir uma vez no corpo.';
  if (blocks.filter((block) => block.type === 'carta').length > 1) return 'A carta de abertura pode existir uma vez só.';
  if (blocks.filter((block) => block.type === 'fechamento').length > 1) return 'O fechamento com assinatura pode existir uma vez só.';
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) return 'Blocos com identificador repetido.';
  return null;
};

const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// escopo: o que se digitou como escopo da proposta (texto ou JSON do layout antigo); vazio ou "A definir" vira "a definir".
const scopeText = (raw: string): string => {
  let value = raw;
  try { const parsed = JSON.parse(raw) as { scope?: unknown }; if (typeof parsed?.scope === 'string') value = parsed.scope; } catch { /* texto simples */ }
  const text = value.trim();
  return text && text.toLowerCase() !== 'a definir' ? text : '';
};

// "Nome - Cargo" do contato cadastrado no cliente; sem contato, vazio (a linha A/C da carta some).
const contactLine = (contact: ProposalDetail['clientContact']): string => [contact?.name, contact?.role].map((part) => part?.trim()).filter(Boolean).join(' - ');

// valor_total e o preco de venda final (com impostos); nenhuma variavel le custo, BDI ou margem.
export const bodyVariables = (proposal: ProposalDetail): BodyVariables => ({
  cliente: proposal.clientName || '',
  obra: proposal.workName || '',
  numero: proposal.number,
  revisao: String(proposal.revision).padStart(2, '0'),
  valor_total: brl.format(getProposalFinancials(proposal).finalValue),
  validade: proposal.validUntil ? dateFmt.format(new Date(`${proposal.validUntil.slice(0, 10)}T00:00:00Z`)) : 'a definir',
  responsavel: proposal.responsibleName || '',
  escopo: scopeText(proposal.scope) || 'a definir',
  contato: contactLine(proposal.clientContact),
  setor_contato: proposal.clientContact?.department?.trim() ?? '',
  email_contato: proposal.clientContact?.email?.trim() ?? '',
  telefone_contato: proposal.clientContact?.phone?.trim() ?? '',
});

// Uma passada so: o valor de uma variavel nunca e reinterpretado como outra variavel.
export const resolveBodyText = (text: string, variables: BodyVariables): string =>
  text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => variables[key.toLowerCase() as BodyVariableKey] ?? match);

export type BodyPart =
  | { kind: 'heading'; text: string; sub: boolean }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'itens'; title: string; caption: string }
  | { kind: 'condicoes'; title: string }
  | { kind: 'carta'; dateLine: string; recipient: string; attention: string; department: string; reference: string; title: string; greeting: string; intro: string }
  | { kind: 'fechamento'; paragraphs: string[][]; signer: string; role: string };

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
// "06 de Agosto de 2026" (formato das propostas da Construtec); data invalida ou vazia some.
export const longDate = (iso: string | undefined): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? '').trim());
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && month ? `${match[3]} de ${month} de ${match[1]}` : '';
};
export const todayIso = (now = new Date()): string => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
export const LETTER_TITLE_DEFAULT = 'Proposta técnica-comercial';

export const bodyParagraphs = (text: string): string[][] =>
  text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

export const bodyListItems = (text: string): string[] =>
  text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim().replace(/^[-*•]\s+/, '').trim()).filter(Boolean);

// Blocos ligados, na ordem escolhida, ja com as variaveis trocadas. Blocos vazios somem.
// Com "numerar" ligado na carta, os titulos ganham 1., 2. ... e os subtitulos 1.1., 1.2. ...
export const resolveBodyParts = (proposal: ProposalDetail, blocks: BodyBlock[]): BodyPart[] => {
  const variables = bodyVariables(proposal);
  const fill = (text: string | undefined) => resolveBodyText(text ?? '', variables);
  const numbered = blocks.some((block) => block.type === 'carta' && block.enabled && block.numbered);
  let section = 0;
  let subsection = 0;
  const label = (title: string, sub: boolean) => {
    if (!numbered) return title;
    if (sub && section > 0) { subsection += 1; return `${section}.${subsection}. ${title}`; }
    section += 1; subsection = 0; return `${section}. ${title}`;
  };
  const parts: BodyPart[] = [];
  for (const block of blocks) {
    if (!block.enabled && block.type !== 'itens') continue;
    const title = fill(block.title).trim();
    const field = (key: BodyFieldKey) => fill(block.fields?.[key]).trim();
    if (block.type === 'itens') parts.push({ kind: 'itens', title: label(title || ITEMS_DEFAULT_TITLE, false), caption: fill(block.text).trim() });
    else if (block.type === 'condicoes') parts.push({ kind: 'condicoes', title: label(title || CONDITIONS_DEFAULT_TITLE, false) });
    else if (block.type === 'carta') {
      const place = field('place');
      const date = longDate(block.fields?.date);
      parts.push({
        kind: 'carta', dateLine: [place, date].filter(Boolean).join(', ') + (place || date ? '.' : ''), recipient: field('recipient'), attention: field('attention'),
        department: field('department'), reference: field('reference'), title: title || LETTER_TITLE_DEFAULT, greeting: field('greeting'), intro: field('intro'),
      });
    } else if (block.type === 'fechamento') parts.push({ kind: 'fechamento', paragraphs: bodyParagraphs(fill(block.text)), signer: field('signer'), role: field('role') });
    else if (block.type === 'titulo') { if (title) parts.push({ kind: 'heading', text: label(title, Boolean(block.sub)), sub: Boolean(block.sub) }); }
    else {
      if (title) parts.push({ kind: 'heading', text: label(title, Boolean(block.sub)), sub: Boolean(block.sub) });
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

// Forma canonica do que o cliente leu (para o hash do aceite): so blocos ligados, sem ids. Os campos novos (nivel,
// numeracao, carta, assinatura) entram so quando existem, entao o hash de um corpo antigo nao muda.
export const bodyFingerprintSource = (blocks: BodyBlock[]) =>
  normalizeBodyBlocks(blocks).filter((block) => block.enabled).map((block) => {
    const extra = { ...(block.sub ? { sub: true } : {}), ...(block.numbered ? { numbered: true } : {}), ...(block.fields ? { fields: block.fields } : {}) };
    const base = [block.type, block.title ?? '', block.text ?? ''];
    return Object.keys(extra).length ? [...base, extra] : base;
  });

const BLANK_FIELDS: Partial<Record<BodyBlockType, BodyFields>> = {
  carta: { place: '', recipient: '{{cliente}}', attention: '{{contato}}', department: '{{setor_contato}}', reference: 'Proposta nº {{numero}} - {{escopo}} - {{obra}}', greeting: 'Prezados Senhores:', intro: 'Atendendo à vossa solicitação, segue nossa proposta técnica-comercial, conforme detalhamento abaixo:' },
  fechamento: { signer: '{{responsavel}}', role: '' },
};
export const emptyBodyBlock = (type: BodyBlockType, today = todayIso(), place = DEFAULT_LETTER_PLACE): BodyBlock => {
  const fields = BLANK_FIELDS[type];
  return {
    id: newBodyId(), type, enabled: true,
    ...(type === 'titulo' ? { title: '' } : type === 'paragrafo' || type === 'lista' || type === 'fechamento' ? { text: '' } : {}),
    ...(type === 'carta' ? { title: LETTER_TITLE_DEFAULT } : {}),
    ...(fields ? { fields: type === 'carta' ? { ...fields, place, date: today } : { ...fields } } : {}),
  };
};

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
