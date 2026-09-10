import type { ProposalDetail, ProposalSummary } from '../shared/contracts';

const statusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '""';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function exportProposalsToCsv(proposals: ProposalSummary[]): boolean {
  if (!proposals || proposals.length === 0) {
    return false;
  }

  const headers = [
    'Número',
    'Revisão',
    'Cliente',
    'Obra / Projeto',
    'Status',
    'Qtd de Itens',
    'Valor Total de Venda',
    'Última Atualização',
  ];

  const rows = proposals.map((prop) => {
    const revFormatted = `REV ${String(prop.revision).padStart(2, '0')}`;
    const statusText = statusLabels[prop.status] || prop.status;
    const valueFormatted = money.format(prop.totalSale);
    const dateFormatted = prop.updatedAt ? dateTime.format(new Date(prop.updatedAt)) : '-';

    return [
      escapeCsvCell(prop.number),
      escapeCsvCell(revFormatted),
      escapeCsvCell(prop.clientName),
      escapeCsvCell(prop.workName),
      escapeCsvCell(statusText),
      escapeCsvCell(prop.itemCount),
      escapeCsvCell(valueFormatted),
      escapeCsvCell(dateFormatted),
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `propostas-construtec-${today}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}
