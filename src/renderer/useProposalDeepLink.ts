import { useEffect, useRef } from 'react';

// Link direto #proposta=<id> (Suite mobile, passo 4): abre a proposta quando
// o app termina de carregar e sempre que o fragmento muda (o app Android troca
// o fragmento da WebView ja aberta, sem recarregar).
const PROPOSAL_ID = /^[A-Za-z0-9-]{1,64}$/;

export const proposalFromHash = (hash: string) => {
  const id = new URLSearchParams(hash.replace(/^#/, '')).get('proposta');
  return id && PROPOSAL_ID.test(id) ? id : null;
};

export function useProposalDeepLink(ready: boolean, open: (proposalId: string) => void) {
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (!ready) return;
    const read = () => {
      const id = proposalFromHash(window.location.hash);
      if (!id) return;
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      openRef.current(id);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [ready]);
}
