import type { ProposalDetail, ProposalSummary } from '../shared/contracts';

export type ValidityState = 'expired' | 'expiringSoon' | 'valid' | 'none';

export type ValidityFilterOption = 'all' | 'expiringSoon' | 'expired' | 'valid' | 'none';

export interface ValidityStatus {
  state: ValidityState;
  daysLeft: number | null;
  label: string;
  badgeClass: string;
  formattedDate: string;
  isAlert: boolean;
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

export const getProposalValidityStatus = (
  validUntil?: string | null,
  status: ProposalDetail['status'] = 'sent',
): ValidityStatus => {
  if (!validUntil) {
    return {
      state: 'none',
      daysLeft: null,
      label: 'A definir',
      badgeClass: 'validity-none',
      formattedDate: '—',
      isAlert: false,
    };
  }

  const [year, month, day] = validUntil.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const formattedDate = dateFmt.format(target);

  if (status === 'approved' || status === 'rejected') {
    return {
      state: 'valid',
      daysLeft: null,
      label: status === 'approved' ? 'Aprovada' : 'Recusada',
      badgeClass: 'validity-closed',
      formattedDate,
      isAlert: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    const absDays = Math.abs(daysLeft);
    return {
      state: 'expired',
      daysLeft,
      label: absDays === 1 ? 'Venceu ontem' : `Vencida há ${absDays}d`,
      badgeClass: 'validity-expired',
      formattedDate,
      isAlert: true,
    };
  }

  if (daysLeft === 0) {
    return {
      state: 'expiringSoon',
      daysLeft,
      label: 'Vence hoje',
      badgeClass: 'validity-urgent',
      formattedDate,
      isAlert: true,
    };
  }

  if (daysLeft <= 3) {
    return {
      state: 'expiringSoon',
      daysLeft,
      label: daysLeft === 1 ? 'Vence amanhã' : `Vence em ${daysLeft}d`,
      badgeClass: 'validity-warning',
      formattedDate,
      isAlert: true,
    };
  }

  return {
    state: 'valid',
    daysLeft,
    label: `Válida (${daysLeft}d)`,
    badgeClass: 'validity-ok',
    formattedDate,
    isAlert: false,
  };
};

export const calculateExtendedDate = (
  currentValidUntil: string | null | undefined,
  daysToAdd: number,
): string => {
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  if (currentValidUntil) {
    const [y, m, d] = currentValidUntil.split('-').map(Number);
    const existing = new Date(y, m - 1, d);
    if (existing.getTime() > base.getTime()) {
      base.setTime(existing.getTime());
    }
  }

  base.setDate(base.getDate() + daysToAdd);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const filterProposalsByValidity = (
  proposals: ProposalSummary[],
  option: ValidityFilterOption,
): ProposalSummary[] => {
  if (option === 'all') return proposals;
  return proposals.filter((p) => {
    const status = getProposalValidityStatus(p.validUntil, p.status);
    return status.state === option;
  });
};
