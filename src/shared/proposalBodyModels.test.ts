import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProposalDetail } from './contracts';
import {
  BODY_LIMITS, BODY_VARIABLES, bodyBlocksError, bodyFingerprintSource, bodyVariables, emptyBodyBlock, longDate, normalizeBodyBlocks,
  resolveBodyParts, type BodyBlock,
} from './proposalBody';
import { BODY_MODELS, findBodyModel, modelBodyBlocks, pendingPlaceholders } from './proposalBodyModels';

const proposal = {
  id: 'p1', number: 'PA-1042', revision: 0, clientName: 'Cliente Teste', workName: 'Obra Teste', scope: 'instalação de cabeamento', responsibleName: 'Maria Responsavel',
  validUntil: '2026-12-30', status: 'draft', isLatest: true, bdiMultiplier: 1.25, taxPercentage: 0, items: [], laborItems: [],
  totals: { materials: 30, labor: 0, baseCost: 30, additions: 20, finalValue: 1234.5, taxAmount: 0, cost: 30, sale: 50, grossResult: 20, marginPercent: 40 },
} as unknown as ProposalDetail;

const block = (patch: Partial<BodyBlock> & Pick<BodyBlock, 'id' | 'type'>): BodyBlock => ({ enabled: true, ...patch });
const tail = [block({ id: 'itens', type: 'itens' }), block({ id: 'cond', type: 'condicoes' })];

test('data por extenso no formato da Construtec e data invalida some', () => {
  assert.equal(longDate('2026-08-06'), '06 de Agosto de 2026');
  assert.equal(longDate('2026-12-30'), '30 de Dezembro de 2026');
  assert.equal(longDate(''), '');
  assert.equal(longDate('06/08/2026'), '');
  assert.equal(longDate('2026-13-01'), '');
});

test('carta de abertura: linha de local e data, campos com variaveis e campo vazio nao sai', () => {
  const carta = block({
    id: 'c', type: 'carta', title: 'Proposta técnica-comercial',
    fields: { place: 'Vitória / ES', date: '2026-08-06', recipient: '{{cliente}}', attention: 'Sr. Fulano', department: '', reference: 'Proposta nº {{numero}} - {{escopo}} - {{obra}}', greeting: 'Prezados Senhores:', intro: '' },
  });
  const [part] = resolveBodyParts(proposal, [carta, ...tail]);
  assert.deepEqual(part, {
    kind: 'carta', dateLine: 'Vitória / ES, 06 de Agosto de 2026.', recipient: 'Cliente Teste', attention: 'Sr. Fulano', department: '',
    reference: 'Proposta nº PA-1042 - instalação de cabeamento - Obra Teste', title: 'Proposta técnica-comercial', greeting: 'Prezados Senhores:', intro: '',
  });
  const onlyDate = resolveBodyParts(proposal, [{ ...carta, fields: { date: '2026-08-06' } }, ...tail])[0];
  assert.equal(onlyDate.kind === 'carta' && onlyDate.dateLine, '06 de Agosto de 2026.');
  const none = resolveBodyParts(proposal, [{ ...carta, fields: {} }, ...tail])[0];
  assert.equal(none.kind === 'carta' && none.dateLine, '');
  assert.equal(resolveBodyParts(proposal, [{ ...carta, enabled: false }, ...tail]).some((item) => item.kind === 'carta'), false);
});

test('variavel escopo: texto digitado, JSON antigo e "A definir"', () => {
  assert.equal(bodyVariables(proposal).escopo, 'instalação de cabeamento');
  assert.equal(bodyVariables({ ...proposal, scope: JSON.stringify({ scope: 'Escopo antigo', executionTerm: '' }) }).escopo, 'Escopo antigo');
  assert.equal(bodyVariables({ ...proposal, scope: 'A definir' }).escopo, 'a definir');
  assert.equal(bodyVariables({ ...proposal, scope: '' }).escopo, 'a definir');
  assert.ok(BODY_VARIABLES.some((variable) => variable.key === 'escopo'));
});

test('numeracao opcional: 1., 2. e 1.1. nos subtitulos; sem a carta ou desligada nao numera', () => {
  const body = (numbered: boolean): BodyBlock[] => [
    block({ id: 'c', type: 'carta', numbered }),
    block({ id: 'a', type: 'paragrafo', title: 'Objetivo', text: 'x' }),
    block({ id: 'b', type: 'titulo', title: 'Responsabilidades' }),
    block({ id: 'c1', type: 'lista', title: 'Da contratada', text: '- um', sub: true }),
    block({ id: 'c2', type: 'lista', title: 'Do cliente', text: '- dois', sub: true }),
    block({ id: 'd', type: 'paragrafo', title: 'Pagamento', text: 'y' }),
    block({ id: 'itens', type: 'itens', title: 'Planilha' }),
    block({ id: 'cond', type: 'condicoes', title: 'Condições' }),
  ];
  const titles = (blocks: BodyBlock[]) => resolveBodyParts(proposal, blocks).flatMap((part) => (part.kind === 'heading' ? [part.text] : part.kind === 'itens' || part.kind === 'condicoes' ? [part.title] : []));
  assert.deepEqual(titles(body(true)), ['1. Objetivo', '2. Responsabilidades', '2.1. Da contratada', '2.2. Do cliente', '3. Pagamento', '4. Planilha', '5. Condições']);
  assert.deepEqual(titles(body(false)), ['Objetivo', 'Responsabilidades', 'Da contratada', 'Do cliente', 'Pagamento', 'Planilha', 'Condições']);
  const sub = resolveBodyParts(proposal, body(true)).find((part) => part.kind === 'heading' && part.text.startsWith('2.1.'));
  assert.equal(sub?.kind === 'heading' && sub.sub, true);
  assert.deepEqual(titles(body(true).filter((item) => item.type !== 'carta')).slice(0, 1), ['Objetivo']);
  assert.deepEqual(titles([block({ id: 'x', type: 'lista', title: 'Subtítulo solto', text: '- a', sub: true }), ...tail]).slice(0, 1), ['Subtítulo solto']);
});

test('fechamento e titulo da planilha: texto com variaveis, assinatura e legenda', () => {
  const parts = resolveBodyParts(proposal, [
    block({ id: 'itens', type: 'itens', title: 'Planilha', text: ' Planilha de {{obra}} ' }), block({ id: 'cond', type: 'condicoes', enabled: false }),
    block({ id: 'f', type: 'fechamento', text: 'Atenciosamente.\n\nAguardamos {{cliente}}.', fields: { signer: '{{responsavel}}', role: 'Engenharia' } }),
  ]);
  assert.deepEqual(parts[0], { kind: 'itens', title: 'Planilha', caption: 'Planilha de Obra Teste' });
  assert.deepEqual(parts[1], { kind: 'fechamento', paragraphs: [['Atenciosamente.'], ['Aguardamos Cliente Teste.']], signer: 'Maria Responsavel', role: 'Engenharia' });
});

test('normalizacao: so os campos do tipo, texto limpo, subtitulo so em texto e uma carta e um fechamento', () => {
  const [carta] = normalizeBodyBlocks([block({ id: 'c', type: 'carta', numbered: true, title: ' Título‮ ', fields: { place: ' Local​ ', signer: 'nao e da carta' } as BodyBlock['fields'], text: 'ignorado', sub: true })]);
  assert.deepEqual(carta, { id: 'c', type: 'carta', enabled: true, title: 'Título', numbered: true, fields: { place: 'Local' } });
  const [fechamento] = normalizeBodyBlocks([block({ id: 'f', type: 'fechamento', text: ' fim ', fields: { signer: 'A', role: 'B', place: 'x' } as BodyBlock['fields'], numbered: true })]);
  assert.deepEqual(fechamento, { id: 'f', type: 'fechamento', enabled: true, text: 'fim', fields: { signer: 'A', role: 'B' } });
  const [item] = normalizeBodyBlocks([block({ id: 'i', type: 'itens', text: `  ${'a'.repeat(300)}\n` })]);
  assert.equal(item.text?.length, BODY_LIMITS.caption);
  const [titulo, lista] = normalizeBodyBlocks([block({ id: 't', type: 'titulo', title: 'T', sub: true }), block({ id: 'l', type: 'lista', text: 'x', sub: false })]);
  assert.equal(titulo.sub, true);
  assert.equal('sub' in lista, false);
  assert.equal(bodyBlocksError([block({ id: 'c1', type: 'carta' }), block({ id: 'c2', type: 'carta' }), ...tail]) ?? '', 'A carta de abertura pode existir uma vez só.');
  assert.match(bodyBlocksError([block({ id: 'f1', type: 'fechamento' }), block({ id: 'f2', type: 'fechamento' }), ...tail]) ?? '', /fechamento/);
  assert.equal(bodyBlocksError([block({ id: 'c1', type: 'carta' }), block({ id: 'f1', type: 'fechamento' }), ...tail]), null);
});

test('impressao digital: corpo antigo nao muda; carta, nivel e assinatura entram no hash', () => {
  const plain = [block({ id: 'a', type: 'paragrafo', title: 'T', text: 'x' }), ...tail];
  assert.deepEqual(bodyFingerprintSource(plain), [['paragrafo', 'T', 'x'], ['itens', '', ''], ['condicoes', '', '']]);
  const withSub = [block({ id: 'a', type: 'paragrafo', title: 'T', text: 'x', sub: true }), ...tail];
  assert.notDeepEqual(bodyFingerprintSource(withSub), bodyFingerprintSource(plain));
  const letter = (place: string) => bodyFingerprintSource([block({ id: 'c', type: 'carta', fields: { place } }), ...tail]);
  assert.notDeepEqual(letter('A'), letter('B'));
  assert.deepEqual(letter('A'), letter('A'));
});

test('blocos novos: carta com data de hoje e variaveis, fechamento com assinatura do responsavel', () => {
  const carta = emptyBodyBlock('carta', '2026-10-07');
  assert.equal(carta.fields?.date, '2026-10-07');
  assert.equal(carta.fields?.recipient, '{{cliente}}');
  assert.equal(carta.title, 'Proposta técnica-comercial');
  const fechamento = emptyBodyBlock('fechamento');
  assert.equal(fechamento.fields?.signer, '{{responsavel}}');
  assert.equal(emptyBodyBlock('itens').fields, undefined);
});

test('modelos completos: dois, validos, na ordem da proposta de servico e so com variaveis conhecidas', () => {
  assert.deepEqual(BODY_MODELS.map((model) => model.id), ['servico', 'fornecimento']);
  assert.equal(findBodyModel('servico')?.name, 'Proposta de serviço (mão de obra)');
  assert.equal(findBodyModel('fornecimento')?.name, 'Proposta de fornecimento (materiais)');
  assert.equal(findBodyModel('outro'), undefined);
  const variables = bodyVariables(proposal);
  for (const model of BODY_MODELS) {
    const blocks = modelBodyBlocks(model, '2026-10-07');
    assert.equal(bodyBlocksError(blocks), null, model.id);
    assert.equal(new Set(blocks.map((item) => item.id)).size, blocks.length, 'ids novos e unicos');
    assert.equal(blocks[0].type, 'carta');
    assert.equal(blocks[0].fields?.date, '2026-10-07');
    assert.equal(blocks[blocks.length - 1].type, 'fechamento');
    assert.equal(blocks.find((item) => item.type === 'condicoes')?.enabled, false, 'condicoes escritas como secoes; o bloco fica desligado');
    for (const item of normalizeBodyBlocks(blocks)) {
      const text = [item.title, item.text, ...Object.values(item.fields ?? {})].join('\n');
      for (const [, key] of text.matchAll(/\{\{(\w+)\}\}/g)) assert.ok(key in variables, `${model.id}: ${key}`);
      assert.doesNotMatch(text, /custo(?!\/benef)|BDI|margem|lucro/i);
    }
    assert.ok(pendingPlaceholders(blocks) > 0);
    assert.notEqual(modelBodyBlocks(model)[0].id, blocks[0].id);
  }
  const titles = resolveBodyParts(proposal, modelBodyBlocks(BODY_MODELS[0])).flatMap((part) => (part.kind === 'heading' ? [part.text] : part.kind === 'itens' ? [part.title] : []));
  assert.deepEqual(titles.map((title) => title.replace(/^[\d.]+\s/, '')), [
    'Apresentação – CONSTRUTEC', 'Objetivo', 'Escopo do serviço', 'Fora de escopo', 'Documentos de referência', 'Mobilização do serviço', 'Prazo de execução do serviço', 'Cronograma',
    'Treinamento', 'Operação assistida', 'Garantia', 'Planilha orçamentária', 'Equipe técnica', 'Responsabilidades do serviço', 'Responsabilidades da CONSTRUTEC',
    'Responsabilidades do CLIENTE', 'Condições de pagamento', 'Prazo de pagamento', 'Validade da proposta',
  ]);
  assert.ok(titles.includes('14. Responsabilidades do serviço'), 'numeracao da carta ligada no modelo');
  assert.ok(titles.includes('14.1. Responsabilidades da CONSTRUTEC') && titles.includes('14.2. Responsabilidades do CLIENTE'));
});

test('pendencias: conta so os trechos entre colchetes dos blocos ligados', () => {
  assert.equal(pendingPlaceholders([block({ id: 'a', type: 'paragrafo', text: 'em [10] dias e [outro]' }), block({ id: 'b', type: 'paragrafo', text: '[x]', enabled: false })]), 2);
  assert.equal(pendingPlaceholders([block({ id: 'a', type: 'paragrafo', text: 'sem pendencia {{cliente}}' })]), 0);
});
