import { useState } from 'react';
import { ClientsOverview } from './ClientsOverview';
import { ClientsRegistry } from './ClientsRegistry';

type Props = {
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  onOpenProposal?: (proposalId: string) => void;
};

// Clientes (Rodada 24): propostas por cliente; o cadastro de clientes e obras continua em "Cadastro de clientes e obras".
export function ClientsWorkspace({ onNotice, onError, onOpenProposal }: Props) {
  const [registry, setRegistry] = useState(false);
  if (registry) return <ClientsRegistry onBack={() => setRegistry(false)} onNotice={onNotice} onError={onError} />;
  return <ClientsOverview onRegistry={() => setRegistry(true)} onOpenProposal={onOpenProposal} />;
}
