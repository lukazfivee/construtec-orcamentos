import { useState } from 'react';
import type { ProposalDetail } from '../shared/contracts';
import { KitsEditor } from './KitsEditor';
import { KitsOverview } from './KitsOverview';

type Props = {
  activeProposal: ProposalDetail | null;
  onApplyKitToProposal?: (kitId: string) => void;
  onOpenProposal?: (proposalId: string) => void;
  onNewProposalWithKit?: (kitId: string) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

// Kits (Rodada 24): lista e "Usar em proposta"; a edicao dos kits continua em "Cadastrar kits".
export function KitsWorkspace({ activeProposal, onApplyKitToProposal, onOpenProposal, onNewProposalWithKit, onNotice, onError }: Props) {
  const [editing, setEditing] = useState(false);
  if (editing) return <KitsEditor activeProposal={activeProposal} onApplyKitToProposal={onApplyKitToProposal} onBack={() => setEditing(false)} onNotice={onNotice} onError={onError} />;
  return <KitsOverview onEdit={() => setEditing(true)} onOpenProposal={onOpenProposal} onNewProposalWithKit={onNewProposalWithKit} onNotice={onNotice} onError={onError} />;
}
