import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import type { AppSettings, ProposalDetail } from '../../shared/contracts';
import { bodyVariables, DEFAULT_LETTER_PLACE, resolveBodyParts, emptyBodyBlock, type BodyBlock } from '../../shared/proposalBody';
import { BODY_MODELS, findBodyModel, modelBodyBlocks } from '../../shared/proposalBodyModels';
import { buildProposalDocx } from '../../documents/proposalDocx';
import { buildProposalHtml } from '../../documents/proposalDocument';
import { buildMobileProposalHtml, parseMobileDocumentChoices } from '../../documents/proposalMobileDocument';
import { clientContactMigration } from '../migrations/022-client-contact';
import { createClient, listClients, updateClient } from './clients';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { bodyBlocksSchema } from './proposalBody';
import { deleteCompanyBodyModel, getCompanyBodyModels, renameCompanyBodyModel, saveCompanyBodyModel } from './proposalBodyModelStore';
import { createProposal, getProposalById } from './proposals';
import { getAppSettings, updateAppSettings } from './settings';

const contact = { name: 'Ana Souza', role: 'Gerente de Obras', department: 'Engenharia', email: 'ana@cliente.com', phone: '(71) 3000-0000' };

test('contato do cliente, local da carta, marca dagua e modelos da empresa', async context => {
  const { database, clientId, workId } = await createCriticalTestDatabase();
  context.after(() => database.close());

  await context.test('migracao 022 e idempotente e o contato vai e volta pelo cadastro', async () => {
    await database.exec(clientContactMigration);
    await database.exec(clientContactMigration);
    assert.deepEqual((await listClients(database)).find((client) => client.id === clientId)?.contact, { name: '', role: '', department: '', email: '', phone: '' });
    const other = await createClient(database, { legalName: 'Outro Cliente', contact });
    assert.deepEqual((await listClients(database, 'Outro'))[0].contact, contact);
    await updateClient(database, other, { legalName: 'Outro Cliente', contact: { ...contact, role: '' } });
    assert.equal((await listClients(database, 'Outro'))[0].contact.role, '');
  });

  await context.test('o contato do cliente preenche a carta pelas variaveis e some quando nao ha contato', async () => {
    await updateClient(database, clientId, { legalName: 'Cliente fictício', tradeName: 'Cliente fictício', contact });
    const id = await createProposal(database, { clientId, workId, scope: 'cabeamento', bodyModel: 'servico' });
    const proposal = (await getProposalById(database, id)) as ProposalDetail;
    assert.deepEqual(proposal.clientContact, contact);
    assert.equal(bodyVariables(proposal).contato, 'Ana Souza - Gerente de Obras');
    const carta = resolveBodyParts(proposal, proposal.bodyBlocks as BodyBlock[]).find((part) => part.kind === 'carta');
    assert.ok(carta && carta.kind === 'carta');
    assert.equal(carta.attention, 'Ana Souza - Gerente de Obras');
    assert.equal(carta.department, 'Engenharia');
    const blank = { ...proposal, clientContact: undefined } as ProposalDetail;
    const semContato = resolveBodyParts(blank, blank.bodyBlocks as BodyBlock[]).find((part) => part.kind === 'carta');
    assert.ok(semContato && semContato.kind === 'carta');
    assert.equal(semContato.attention, '');
  });

  await context.test('local da carta: padrao Salvador / BA, troca em Configuracoes vale para propostas novas e blocos novos', async () => {
    assert.equal((await getAppSettings(database)).letterPlace, DEFAULT_LETTER_PLACE);
    assert.equal(modelBodyBlocks(BODY_MODELS[0])[0].fields?.place, 'Salvador / BA');
    assert.equal(emptyBodyBlock('carta').fields?.place, 'Salvador / BA');
    assert.equal(emptyBodyBlock('carta', '2026-01-01', 'Recife / PE').fields?.place, 'Recife / PE');
    await updateAppSettings(database, { letterPlace: '  Recife / PE ' });
    assert.equal((await getAppSettings(database)).letterPlace, 'Recife / PE');
    const id = await createProposal(database, { clientId, workId, scope: 'x', bodyModel: 'fornecimento' });
    assert.equal((await getProposalById(database, id))?.bodyBlocks?.[0].fields?.place, 'Recife / PE');
    await updateAppSettings(database, { letterPlace: '   ' });
    assert.equal((await getAppSettings(database)).letterPlace, 'Recife / PE', 'vazio nao apaga o padrao');
  });

  await context.test('modelo da empresa: salvar, atualizar pelo mesmo nome, aplicar na criacao, renomear e excluir', async () => {
    const blocks = bodyBlocksSchema.parse(modelBodyBlocks(BODY_MODELS[1]));
    let models = await saveCompanyBodyModel(database, 'Meu modelo', blocks);
    assert.equal(models.length, 1);
    assert.ok(models[0].blocks.every((block) => !('id' in block)), 'ids nao ficam gravados');
    models = await saveCompanyBodyModel(database, 'meu MODELO', blocks.slice(0, 4).concat(blocks.filter((block) => block.type === 'itens' || block.type === 'condicoes')));
    assert.equal(models.length, 1, 'mesmo nome atualiza');
    const id = await createProposal(database, { clientId, workId, scope: 'x', bodyModel: models[0].id });
    const saved = (await getProposalById(database, id))?.bodyBlocks ?? [];
    assert.equal(saved.length, models[0].blocks.length);
    assert.ok(findBodyModel(models[0].id, models));
    assert.equal(findBodyModel(models[0].id), undefined, 'so aparece com a lista da empresa');
    await saveCompanyBodyModel(database, 'Segundo', blocks);
    await assert.rejects(renameCompanyBodyModel(database, models[0].id, 'segundo'), /BODY_MODEL_NAME_TAKEN/);
    await assert.rejects(renameCompanyBodyModel(database, 'nao-existe', 'Novo'), /BODY_MODEL_NOT_FOUND/);
    assert.equal((await renameCompanyBodyModel(database, models[0].id, 'Renomeado'))[0].name, 'Renomeado');
    assert.equal((await deleteCompanyBodyModel(database, models[0].id)).length, 1);
    assert.equal((await getCompanyBodyModels(database)).length, 1);
  });

  await context.test('marca dagua: padrao da empresa, escolha do PDF vale e o Word leva a imagem atras do texto', async () => {
    const id = await createProposal(database, { clientId, workId, scope: 'x', bodyModel: 'servico' });
    const proposal = (await getProposalById(database, id)) as ProposalDetail;
    const off = { companyName: 'T', pdfShowLogo: true, pdfShowSignature: true, pdfWatermark: false } as AppSettings;
    const on = { ...off, pdfWatermark: true } as AppSettings;
    assert.ok(!buildProposalHtml(proposal, off).includes('class="watermark"'));
    assert.ok(buildProposalHtml(proposal, on).includes('class="watermark"'));
    assert.ok(buildProposalHtml(proposal, off, { watermark: true }).includes('class="watermark"'), 'a escolha do PDF liga');
    assert.ok(!buildProposalHtml(proposal, on, { watermark: false }).includes('class="watermark"'), 'a escolha do PDF desliga');
    assert.ok(buildMobileProposalHtml(proposal, off, parseMobileDocumentChoices({ marca: '1' })).includes('class="watermark"'));
    assert.ok(!buildMobileProposalHtml(proposal, on, parseMobileDocumentChoices({ marca: '0' })).includes('class="watermark"'));
    assert.ok(buildMobileProposalHtml(proposal, on, parseMobileDocumentChoices({})).includes('class="watermark"'));
    const docx = async (settings: AppSettings) => {
      const zip = await JSZip.loadAsync(await buildProposalDocx(proposal, settings));
      return Promise.all(Object.keys(zip.files).filter((name) => /word\/header\d*\.xml$/.test(name)).map((name) => zip.file(name)!.async('string')));
    };
    assert.ok((await docx(on)).some((xml) => xml.includes('behindDoc="1"')), 'imagem flutuante atras do texto');
    assert.ok(!(await docx(off)).some((xml) => xml.includes('behindDoc="1"')));
  });
});
