import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODY_LIMITS, bodyBlocksError, type BodyBlock } from '../../shared/proposalBody';
import { BODY_MODELS, modelBodyBlocks } from '../../shared/proposalBodyModels';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { bodyBlocksSchema, saveDefaultBody, updateProposalBody } from './proposalBody';
import { createProposal, getProposalById } from './proposals';

const withTail = (...extra: BodyBlock[]): BodyBlock[] => [...extra, { id: 'itens', type: 'itens', enabled: true }, { id: 'cond', type: 'condicoes', enabled: true }];

test('modelo de proposta na criacao: servico, fornecimento, corpo padrao e sem modelo', async context => {
  const { database, clientId, workId } = await createCriticalTestDatabase();
  context.after(() => database.close());

  await context.test('cada modelo nasce na proposta pronto para editar e valido para gravar', async () => {
    for (const model of BODY_MODELS) {
      const id = await createProposal(database, { clientId, workId, scope: 'instalação de cabeamento', bodyModel: model.id });
      const saved = (await getProposalById(database, id))?.bodyBlocks ?? [];
      assert.equal(saved.length, model.blocks.length);
      assert.equal(saved[0].type, 'carta');
      assert.equal(saved[saved.length - 1].type, 'fechamento');
      assert.match(saved[0].fields?.date ?? '', /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(!saved.some((block) => block.title === 'Escopo' && block.type === 'paragrafo' && block.text === 'instalação de cabeamento'), 'o escopo digitado entra pela variavel, nao como bloco extra');
      assert.equal(bodyBlocksError(saved), null);
      await updateProposalBody(database, id, bodyBlocksSchema.parse(saved));
    }
  });

  await context.test('o modelo escolhido vale no lugar do corpo padrao; sem modelo vale o padrao da empresa; sem nada, layout antigo', async () => {
    const none = await createProposal(database, { clientId, workId, scope: 'Escopo A' });
    assert.equal((await getProposalById(database, none))?.bodyBlocks, null);
    await saveDefaultBody(database, withTail({ id: 'pad', type: 'paragrafo', text: 'padrao da empresa', enabled: true }));
    const standard = await createProposal(database, { clientId, workId, scope: 'Escopo B' });
    assert.equal((await getProposalById(database, standard))?.bodyBlocks?.[0].text, 'padrao da empresa');
    const model = await createProposal(database, { clientId, workId, scope: 'Escopo C', bodyModel: 'fornecimento' });
    assert.equal((await getProposalById(database, model))?.bodyBlocks?.[0].type, 'carta');
    await saveDefaultBody(database, null);
  });

  await context.test('o servidor aceita carta, fechamento, subtitulo e campos; recusa campo desconhecido e texto grande demais', () => {
    const parsed = bodyBlocksSchema.parse(modelBodyBlocks(BODY_MODELS[0]));
    assert.equal(parsed.find((block) => block.type === 'carta')?.numbered, true);
    assert.equal(parsed.filter((block) => block.sub).length, 2);
    assert.equal(parsed.find((block) => block.type === 'itens')?.text, 'Planilha de mão de obra - {{obra}}');
    const carta = (fields: unknown) => withTail({ id: 'c', type: 'carta', enabled: true, fields } as BodyBlock);
    assert.equal(bodyBlocksSchema.safeParse(carta({ place: 'Vitória', segredo: 'x' })).success, false, 'campo desconhecido');
    assert.equal(bodyBlocksSchema.safeParse(carta({ reference: 'a'.repeat(BODY_LIMITS.field + 1) })).success, false, 'campo acima do limite');
    assert.equal(bodyBlocksSchema.safeParse(carta({ reference: 'a'.repeat(BODY_LIMITS.field) })).success, true);
    assert.equal(bodyBlocksSchema.safeParse([...carta({}).slice(0, 1), ...carta({})]).success, false, 'duas cartas');
    const limpo = bodyBlocksSchema.parse(carta({ place: ' Vitória​ ', attention: 'Sr.\u0007 X' }));
    assert.deepEqual(limpo[0].fields, { place: 'Vitória', attention: 'Sr. X' });
  });
});
