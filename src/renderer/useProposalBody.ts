import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProposalDetail } from '../shared/contracts';
import { parseCommercialConditions } from '../documents/proposalDocumentCommon';
import { legacyBodyBlocks, type BodyBlock } from '../shared/proposalBody';
import { proposalApi } from './api';
import { setUnsavedChanges } from './unsavedChanges';

export type BodySaveState = 'idle' | 'saving' | 'error';

const AUTOSAVE_MS = 1200;
export const initialBody = (proposal: ProposalDetail): BodyBlock[] =>
  proposal.bodyBlocks ?? legacyBodyBlocks(parseCommercialConditions(proposal.scope).scope);

// Rascunho do corpo da proposta com salvamento automatico: grava ~1,2 s depois da ultima edicao, ao sair da aba e
// antes de abrir o PDF. O servidor devolve a proposta inteira, que volta para o editor (sem sobrescrever o rascunho).
export function useProposalBody(proposal: ProposalDetail, editable: boolean, onUpdateProposal: (proposal: ProposalDetail) => void, setError: (message: string) => void) {
  const [draft, setDraft] = useState<BodyBlock[]>(() => initialBody(proposal));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialBody(proposal)));
  const [state, setState] = useState<BodySaveState>('idle');
  const [failedJson, setFailedJson] = useState('');
  const draftRef = useRef(draft);
  const savedRef = useRef(savedJson);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  draftRef.current = draft;
  savedRef.current = savedJson;
  const draftJson = JSON.stringify(draft);
  const dirty = editable && draftJson !== savedJson;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const callbacks = useRef({ onUpdateProposal, setError });
  callbacks.current = { onUpdateProposal, setError };

  const persist = useCallback(async (blocks: BodyBlock[] | null, sentJson: string): Promise<boolean> => {
    setState('saving');
    try {
      const result = await proposalApi.updateBody(proposal.id, blocks);
      savedRef.current = sentJson;
      setSavedJson(sentJson);
      setFailedJson('');
      setState('idle');
      callbacks.current.onUpdateProposal(result.proposal);
      return true;
    } catch (error) {
      setFailedJson(sentJson);
      setState('error');
      callbacks.current.setError(error instanceof Error ? error.message : 'Não foi possível salvar o corpo da proposta.');
      return false;
    }
  }, [proposal.id]);

  // Uma gravacao por vez: a seguinte espera a anterior e regrava so se ainda houver mudanca.
  const flush = useCallback((): Promise<boolean> => {
    queue.current = queue.current.then(() => {
      const json = JSON.stringify(draftRef.current);
      return json === savedRef.current ? true : persist(draftRef.current, json);
    });
    return queue.current;
  }, [persist]);

  useEffect(() => {
    if (!dirty || state === 'saving' || failedJson === draftJson) return undefined;
    const timer = window.setTimeout(() => { void flush(); }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, draftJson, state, failedJson, flush]);

  useEffect(() => { setUnsavedChanges('corpo-proposta', dirty); }, [dirty]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  // Ao sair da aba com mudanca pendente, grava antes de fechar.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => {
    setUnsavedChanges('corpo-proposta', false);
    if (dirtyRef.current) void flushRef.current();
  }, []);

  // Volta ao documento no layout fixo de sempre (apaga o corpo montado).
  const resetToDefault = useCallback(async (): Promise<boolean> => {
    const legacy = legacyBodyBlocks(parseCommercialConditions(proposal.scope).scope);
    queue.current = queue.current.then(async () => {
      const ok = await persist(null, JSON.stringify(legacy));
      if (ok) setDraft(legacy);
      return ok;
    });
    return queue.current;
  }, [persist, proposal.scope]);

  return { draft, setDraft, dirty, state, flush, resetToDefault };
}
