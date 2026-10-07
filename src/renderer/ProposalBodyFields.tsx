// Campos da carta de abertura e da assinatura de fechamento no cartao do corpo da proposta.
import type { BodyBlock, BodyFieldKey } from '../shared/proposalBody';
import { BODY_LIMITS } from '../shared/proposalBody';

type Row = { key: BodyFieldKey; label: string; placeholder: string; kind?: 'date' | 'long' };

const LETTER_ROWS: Row[] = [
  { key: 'place', label: 'Local', placeholder: 'Ex.: Salvador / BA' },
  { key: 'date', label: 'Data', placeholder: '', kind: 'date' },
  { key: 'recipient', label: 'Empresa destinatária', placeholder: '{{cliente}}' },
  { key: 'attention', label: 'A/C (nome e tratamento)', placeholder: 'Ex.: Sr. Fulano de Tal' },
  { key: 'department', label: 'Setor', placeholder: 'Ex.: Engenharia' },
  { key: 'reference', label: 'REF. (assunto da proposta)', placeholder: 'Proposta nº {{numero}} - {{escopo}} - {{obra}}', kind: 'long' },
  { key: 'greeting', label: 'Saudação', placeholder: 'Prezados Senhores:' },
  { key: 'intro', label: 'Frase de abertura', placeholder: 'Atendendo à vossa solicitação, segue nossa proposta...', kind: 'long' },
];
const SIGNATURE_ROWS: Row[] = [
  { key: 'signer', label: 'Nome na assinatura', placeholder: '{{responsavel}}' },
  { key: 'role', label: 'Cargo ou setor (opcional)', placeholder: 'Ex.: Engenharia' },
];

type Props = { block: BodyBlock; editable: boolean; onChange: (patch: Partial<Omit<BodyBlock, 'id' | 'type'>>) => void };

// Campos de uma linha; os de texto aceitam variaveis ({{cliente}}, {{obra}}, {{numero}}, {{escopo}}...).
export function ProposalBodyFields({ block, editable, onChange }: Props) {
  const rows = block.type === 'carta' ? LETTER_ROWS : block.type === 'fechamento' ? SIGNATURE_ROWS : [];
  if (rows.length === 0) return null;
  const set = (key: BodyFieldKey, value: string) => onChange({ fields: { ...block.fields, [key]: value } });
  return (
    <>
      <div className="body-fields">
        {rows.map((row) => (
          <label key={row.key} className={`body-field${row.kind === 'long' ? ' is-wide' : ''}`}>{row.label}
            <input
              id={`body-${row.key}-${block.id}`} type={row.kind === 'date' ? 'date' : 'text'} value={block.fields?.[row.key] ?? ''} maxLength={BODY_LIMITS.field}
              placeholder={row.placeholder} disabled={!editable} onChange={(event) => set(row.key, event.currentTarget.value)}
            />
          </label>
        ))}
      </div>
      {block.type === 'carta' && (
        <label className="body-check">
          <input type="checkbox" checked={Boolean(block.numbered)} disabled={!editable} onChange={(event) => onChange({ numbered: event.currentTarget.checked })} />
          Numerar os títulos das seções (1., 2., 3. ... e 1.1. nos subtítulos)
        </label>
      )}
      <p className="body-note">Os campos aceitam variáveis como {'{{cliente}}'}, {'{{obra}}'}, {'{{numero}}'} e {'{{escopo}}'}. Campo em branco não sai no documento.</p>
    </>
  );
}
