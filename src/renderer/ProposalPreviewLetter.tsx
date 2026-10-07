// Carta de abertura e fechamento com assinatura na pre-visualizacao da proposta (mesmo texto do PDF e do Word).
import type { BodyPart } from '../shared/proposalBody';

type Letter = Extract<BodyPart, { kind: 'carta' }>;
type Closing = Extract<BodyPart, { kind: 'fechamento' }>;

export function LetterPreview({ part }: { part: Letter }) {
  return (
    <section className="sheet-letter">
      {part.dateLine && <p>{part.dateLine}</p>}
      {part.recipient && <p className="sheet-letter-to">{part.recipient}</p>}
      {(part.attention || part.department) && (
        <p className="sheet-letter-att"><b>At.:</b><span>{[part.attention, part.department].filter(Boolean).join('\n')}</span></p>
      )}
      {part.reference && <p className="sheet-letter-ref">REF.: {part.reference}</p>}
      <div className="sheet-letter-title">{part.title}</div>
      {part.greeting && <p>{part.greeting}</p>}
      {part.intro && <p>{part.intro}</p>}
    </section>
  );
}

export function ClosingPreview({ part, company, brand, showSignature }: { part: Closing; company: string; brand: string; showSignature: boolean }) {
  return (
    <section className="sheet-closing-block">
      {part.paragraphs.map((lines, index) => <p key={index} className="sheet-copy" style={{ whiteSpace: 'pre-line' }}>{lines.join('\n')}</p>)}
      {showSignature && (
        <div className="sheet-signature">
          <b>{part.signer || brand}</b>
          {part.role && <span>{part.role}</span>}
          <span>{company}</span>
        </div>
      )}
    </section>
  );
}
