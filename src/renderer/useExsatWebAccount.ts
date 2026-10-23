// Estado da conta da Exsat no servidor, para o site no computador (a mesma leitura do celular: /api/exsat/status).
// Sem a permissao de custo (p10) o servidor recusa e a tela simplesmente nao mostra o estado.
import { useEffect, useState } from 'react';
import { exsatServerApi } from './exsatServerApi';

export type ExsatWebAccount = { connected: boolean; keyConfigured: boolean };

/** Mesma frase do celular (public/m/exsat-conta.js) e do cartao Conta Exsat: sem nome tecnico. */
export const EXSAT_NOT_CONFIGURED = 'A conexão com a Exsat ainda não foi configurada no servidor, então a conta não é guardada. Peça ao responsável pelo sistema para configurar.';

export function useExsatWebAccount(enabled: boolean): ExsatWebAccount | null {
  const [account, setAccount] = useState<ExsatWebAccount | null>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    exsatServerApi.status()
      .then(({ status }) => { if (active) setAccount({ connected: !!status.connected, keyConfigured: !!status.keyConfigured }); })
      .catch(() => { if (active) setAccount(null); });
    return () => { active = false; };
  }, [enabled]);
  return account;
}
