import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProposalDetail } from './contracts';
import {
  BODY_LIMITS, BUILTIN_BODY_TEMPLATES, bodyBlocksError, bodyFingerprintSource, bodyVariables, cleanBodyText, legacyBodyBlocks,
  normalizeBodyBlocks, resolveBodyParts, resolveBodyText, seedBodyBlocks, type BodyBlock,
} from './proposalBody';

const proposal = {
  id: 'p1', number: 'PA-1001', revision: 2, clientName: 'Cliente Teste', workName: 'Obra Teste', scope: 'Instalacao', responsibleName: 'Maria Responsavel',
  validUntil: '2026-12-30', status: 'draft', isLatest: true, bdiMultiplier: 1.25, taxPercentage: 0,
  items: [{ id: 'i1', code: 'C1', description: 'Cabo', unit: 'm', quantity: 10, unitCost: 3, unitSale: 5, totalSale: 50, totalCost: 30, category: 'Cabos' }],
  laborItems: [], totals: { materials: 30, labor: 0, baseCost: 30, additions: 20, finalValue: 1234.5, taxAmount: 0, cost: 30, sale: 50, grossResult: 20, marginPercent: 40 },
} as unknown as ProposalDetail;

const block = (patch: Partial<BodyBlock> & Pick<BodyBlock, 'id' | 'type'>): BodyBlock => ({ enabled: true, ...patch });
const base = (...extra: BodyBlock[]): BodyBlock[] => [...extra, block({ id: 'itens', type: 'itens' }), block({ id: 'cond', type: 'condicoes' })];

test('variaveis: cliente, obra, numero, revisao, valor total de venda, validade e responsavel', () => {
  const text = resolveBodyText('{{cliente}} | {{obra}} | {{numero}} | {{ revisao }} | {{valor_total}} | {{validade}} | {{responsavel}} | {{DESCONHECIDA}}', bodyVariables(proposal));
  assert.match(text, /^Cliente Teste \| Obra Teste \| PA-1001 \| 02 \| R\$\s1\.234,50 \| 30\/12\/2026 \| Maria Responsavel \| \{\{DESCONHECIDA\}\}$/);
});

test('variaveis nunca leem custo, BDI ou margem e o valor nao e reinterpretado', () => {
  const variables = bodyVariables(proposal);
  assert.equal(Object.keys(variables).sort().join(','), 'cliente,numero,obra,responsavel,revisao,validade,valor_total');
  assert.doesNotMatch(JSON.stringify(variables), /1,25|30,00|40/);
  assert.equal(resolveBodyText('{{cliente}}', { ...variables, cliente: '{{obra}}' }), '{{obra}}');
  assert.match(bodyVariables({ ...proposal, validUntil: null }).validade, /a definir/);
});

test('paragrafos respeitam quebras de linha e lista vira marcadores', () => {
  const parts = resolveBodyParts(proposal, base(
    block({ id: 'a', type: 'paragrafo', title: 'Escopo', text: 'Linha 1\nLinha 2\n\nSegundo paragrafo' }),
    block({ id: 'b', type: 'lista', text: '- Um\n* Dois\n• Tres\n\nQuatro' }),
  ));
  assert.deepEqual(parts.slice(0, 4), [
    { kind: 'heading', text: 'Escopo' },
    { kind: 'paragraph', lines: ['Linha 1', 'Linha 2'] },
    { kind: 'paragraph', lines: ['Segundo paragrafo'] },
    { kind: 'list', items: ['Um', 'Dois', 'Tres', 'Quatro'] },
  ]);
});

test('ordem: segue a lista, blocos desligados e vazios somem, tabela de itens sempre fica', () => {
  const parts = resolveBodyParts(proposal, [
    block({ id: 'x', type: 'paragrafo', text: 'antes dos itens' }),
    block({ id: 'itens', type: 'itens', enabled: false }),
    block({ id: 'y', type: 'paragrafo', text: 'desligado', enabled: false }),
    block({ id: 'z', type: 'paragrafo', text: '   ' }),
    block({ id: 't', type: 'titulo', title: 'Fechamento' }),
    block({ id: 'cond', type: 'condicoes', title: 'Condicoes' }),
  ]);
  assert.deepEqual(parts.map((part) => part.kind), ['paragraph', 'itens', 'heading', 'condicoes']);
  assert.deepEqual(parts[1], { kind: 'itens', title: 'Composição e precificação' });
});

test('limpeza do texto remove controle e formatacao invisivel (inclui U+202E e zero-width)', () => {
  assert.equal(cleanBodyText('a‮b​c\u0000d\te\u0007', false), 'abcd e');
  assert.equal(cleanBodyText('linha​1\r\nlinha2\t\u0001\n', true), 'linha1\nlinha2');
  const [normalized] = normalizeBodyBlocks([block({ id: 'a', type: 'paragrafo', title: ' T‮ ', text: ' x​ ' })]);
  assert.deepEqual(normalized, { id: 'a', type: 'paragrafo', enabled: true, title: 'T', text: 'x' });
});

test('estrutura: uma tabela de itens, um bloco de condicoes, ids unicos e ate 60 blocos', () => {
  assert.equal(bodyBlocksError(base()), null);
  assert.match(bodyBlocksError([block({ id: 'c', type: 'condicoes' })]) ?? '', /tabela de itens/);
  assert.match(bodyBlocksError([block({ id: 'i', type: 'itens' })]) ?? '', /condições/);
  assert.match(bodyBlocksError([...base(), block({ id: 'i2', type: 'itens' })]) ?? '', /tabela de itens/);
  assert.match(bodyBlocksError([...base(), block({ id: 'itens', type: 'paragrafo' })]) ?? '', /repetido/);
  const many = Array.from({ length: BODY_LIMITS.blocks - 1 }, (_, i) => block({ id: `p${i}`, type: 'paragrafo', text: 'x' }));
  assert.match(bodyBlocksError([...many, ...base()]) ?? '', /60 blocos/);
  assert.equal(bodyBlocksError([...many.slice(0, BODY_LIMITS.blocks - 2), ...base()]), null);
  assert.equal(normalizeBodyBlocks([block({ id: 'itens', type: 'itens', enabled: false })])[0].enabled, true);
});

test('corpo antigo em blocos e corpo padrao de proposta nova', () => {
  const legacy = legacyBodyBlocks('Instalar cameras');
  assert.deepEqual(legacy.map((item) => item.type), ['paragrafo', 'paragrafo', 'paragrafo', 'itens', 'condicoes']);
  assert.equal(legacy[2].text, 'Instalar cameras');
  assert.equal(legacyBodyBlocks('A definir').length, 4);
  assert.equal(seedBodyBlocks(null, 'x'), null);
  const seeded = seedBodyBlocks(base(block({ id: 'k', type: 'paragrafo', text: 'abertura' })), 'Escopo digitado') ?? [];
  assert.deepEqual(seeded.map((item) => item.type), ['paragrafo', 'paragrafo', 'itens', 'condicoes']);
  assert.equal(seeded[1].text, 'Escopo digitado');
  assert.ok(new Set(seeded.map((item) => item.id)).size === seeded.length && !seeded.some((item) => item.id === 'k'));
});

test('modelos sugeridos: seis, dentro dos limites e so com variaveis conhecidas', () => {
  assert.equal(BUILTIN_BODY_TEMPLATES.length, 6);
  for (const template of BUILTIN_BODY_TEMPLATES) {
    assert.ok(template.text.length <= BODY_LIMITS.text && template.name.length <= BODY_LIMITS.templateName);
    for (const [, key] of template.text.matchAll(/\{\{(\w+)\}\}/g)) assert.ok(key in bodyVariables(proposal), key);
  }
});

test('impressao digital do corpo ignora ids e blocos desligados', () => {
  const one = [block({ id: 'a', type: 'paragrafo', text: 'oi' }), block({ id: 'b', type: 'paragrafo', text: 'x', enabled: false }), ...base()];
  const two = [block({ id: 'zzz', type: 'paragrafo', text: 'oi' }), ...base()];
  assert.deepEqual(bodyFingerprintSource(one), bodyFingerprintSource(two));
});
