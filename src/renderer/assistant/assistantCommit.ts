// Cria de verdade a proposta do rascunho, so quando a pessoa toca em "Criar proposta" (a IA nao chama isto).
// Usa as mesmas rotas das telas, com a sessao de quem esta logado: auditoria, perfil e permissoes valem como no formulario.
// Cliente e obra novos entram antes da proposta; se algo falhar no meio, o rascunho devolvido guarda o que ja foi criado
// (a segunda tentativa nao duplica cadastro).
import { missing, scopeForSave, validUntil } from './proposalDraft';
import type { ProposalDraft } from './proposalDraft';

export interface CommitApi {
  createClient(input: { legalName: string; tradeName: string | null; document: string | null }): Promise<{ clientId: string }>;
  createWork(clientId: string, input: { name: string; address: string | null }): Promise<{ workId: string }>;
  createProposal(input: { clientId: string; workId: string; scope: string; validUntil: string | null; bodyModel?: string }): Promise<{ proposal: { id: string } }>;
  updateBdi(proposalId: string, bdiMultiplier: number): Promise<unknown>;
  updateTax(proposalId: string, taxPercentage: number): Promise<unknown>;
  importItems(proposalId: string, items: Array<{ code?: string; description: string; unit?: string; quantity: number; unitCost?: number; unitSale?: number }>): Promise<unknown>;
}

export interface CommitResult {
  /** Rascunho com os ids ja criados (para tentar de novo sem duplicar). */
  draft: ProposalDraft;
  proposalId?: string;
  /** Aviso quando a proposta existe mas algo ficou de fora (ex.: os itens). */
  aviso?: string;
  erro?: string;
}

const message = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export async function commitDraft(api: CommitApi, input: ProposalDraft, now: Date = new Date()): Promise<CommitResult> {
  let draft = { ...input };
  const falta = missing(draft);
  if (falta.length) return { draft, erro: `Falta informar: ${falta.join(', ')}.` };
  try {
    if (!draft.clientId) {
      const { clientId } = await api.createClient({ legalName: draft.clientName as string, tradeName: null, document: null });
      draft = { ...draft, clientId, newClient: false };
    }
    if (!draft.workId) {
      const { workId } = await api.createWork(draft.clientId as string, { name: draft.workName as string, address: draft.workAddress ?? null });
      draft = { ...draft, workId, newWork: false };
    }
  } catch (error) {
    return { draft, erro: message(error, 'Não consegui cadastrar o cliente ou a obra.') };
  }
  let proposalId: string;
  try {
    const created = await api.createProposal({
      clientId: draft.clientId as string, workId: draft.workId as string, scope: scopeForSave(draft), validUntil: validUntil(draft, now),
      ...(draft.model ? { bodyModel: draft.model } : {}),
    });
    proposalId = created.proposal.id;
  } catch (error) {
    return { draft, erro: message(error, 'Não consegui criar a proposta.') };
  }
  // BDI e imposto antes dos itens: o preco de venda de cada item nasce com o BDI da proposta.
  try {
    if (draft.bdiMultiplier !== undefined) await api.updateBdi(proposalId, draft.bdiMultiplier);
    if (draft.taxPercentage !== undefined) await api.updateTax(proposalId, draft.taxPercentage);
  } catch (error) {
    return { draft, proposalId, aviso: `A proposta foi criada, mas o BDI ou o imposto não foram aplicados e os itens não entraram (${message(error, 'erro')}). Ajuste no editor.` };
  }
  if (draft.items.length === 0) return { draft, proposalId };
  try {
    // Item do catalogo vai so com o codigo (o servidor traz descricao, unidade e custo do catalogo). Avulso com custo dito pela
    // pessoa vai so com o custo (o preco de venda sai do BDI da proposta); sem custo vai sem preco.
    await api.importItems(proposalId, draft.items.map((item) => (item.code
      ? { code: item.code, description: item.description, quantity: item.quantity }
      : item.unitCost !== undefined
        ? { description: item.description, unit: item.unit, quantity: item.quantity, unitCost: item.unitCost }
        : { description: item.description, unit: item.unit, quantity: item.quantity, unitCost: 0, unitSale: 0 })));
  } catch (error) {
    return { draft, proposalId, aviso: `A proposta foi criada, mas os itens não entraram (${message(error, 'erro ao importar')}). Adicione-os no editor.` };
  }
  return { draft, proposalId };
}
