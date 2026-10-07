import React, { useMemo } from 'react';
import type { ProposalDetail, ProposalLine } from '../shared/contracts';
import { CONSTRUTEC_LOGO_BASE64 } from '../assets/logoBase64';
import { resolveBodyParts, type BodyPart } from '../shared/proposalBody';
import { getProposalFinancials } from '../shared/proposalFinancials';
import {
  commercialLaborTotal,
  date,
  groupItemsByCategory,
  money,
  parseCommercialConditions,
  quantity,
  roundMoney,
} from '../documents/proposalDocumentCommon';
import { ClosingPreview, LetterPreview } from './ProposalPreviewLetter';

interface ProposalPreviewSheetProps {
  proposal: ProposalDetail;
  groupByCategory: boolean;
  showProductCodes: boolean;
  includeLabor: boolean;
  includeCommercialTerms: boolean;
  includeNotes: boolean;
  customNotes?: string;
}

export const ProposalPreviewSheet: React.FC<ProposalPreviewSheetProps> = ({
  proposal,
  groupByCategory,
  showProductCodes,
  includeLabor,
  includeCommercialTerms,
  includeNotes,
  customNotes,
}) => {
  const conditions = useMemo(() => parseCommercialConditions(proposal.scope), [proposal.scope]);
  const financials = useMemo(() => getProposalFinancials(proposal), [proposal]);
  const total = financials.finalValue;
  const laborTotal = useMemo(() => (includeLabor ? commercialLaborTotal(proposal) : 0), [includeLabor, proposal]);
  const materialsTotal = useMemo(
    () => (laborTotal > 0 ? roundMoney(total - laborTotal) : total),
    [total, laborTotal]
  );
  const groupedItems = useMemo(() => groupItemsByCategory(proposal), [proposal]);

  const combinedNotes = useMemo(() => {
    const list = [conditions.notes, customNotes?.trim()].filter(Boolean);
    return list.join('\n\n');
  }, [conditions.notes, customNotes]);

  const formattedDate = useMemo(() => date.format(new Date()), []);
  const validUntilFormatted = useMemo(() => {
    return proposal.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : 'A definir';
  }, [proposal.validUntil]);

  let itemCounter = 0;

  const bodyParts = proposal.bodyBlocks ? resolveBodyParts(proposal, proposal.bodyBlocks) : null;
  const introNode = (
    <>
      <p className="sheet-lead">
        Prezados Senhores,
        <br />
        Apresentamos nossa proposta técnica e comercial para fornecimento de equipamentos, materiais e execução dos
        serviços descritos a seguir.
      </p>

      {/* 4. Apresentação e Objetivo */}
      <div className="sheet-h2">Apresentação — CONSTRUTEC</div>
      <p className="sheet-copy">
        A CONSTRUTEC atua no desenvolvimento de soluções de engenharia e tecnologia, automação, elétrica, combate a
        incêndio, infraestrutura de dados e telecomunicações.
      </p>

      <div className="sheet-h2">1. Objetivo</div>
      <p className="sheet-copy">{conditions.scope || proposal.scope || 'Fornecimento e montagem de infraestrutura.'}</p>
    </>
  );
  const pricingNode = (title: string) => (
    <>
      {/* 5. Precificação */}
      <div className="sheet-h2">{title}</div>
      <table className="sheet-pricing-table">
        <thead>
          <tr>
            <th style={{ width: '7%' }} className="center">ITEM</th>
            <th style={{ width: '45%' }}>DESCRIÇÃO</th>
            <th style={{ width: '8%' }} className="center">UN.</th>
            <th style={{ width: '10%' }} className="number">QTD.</th>
            <th style={{ width: '15%' }} className="number">VALOR UNIT.</th>
            <th style={{ width: '15%' }} className="number">VALOR TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {groupByCategory
            ? groupedItems.map(([category, items]) => (
                <React.Fragment key={category}>
                  <tr className="sheet-category-row">
                    <td colSpan={6}>{category}</td>
                  </tr>
                  {items.map((item: ProposalLine) => {
                    itemCounter += 1;
                    return (
                      <tr key={item.id}>
                        <td className="center">{itemCounter}</td>
                        <td>
                          {item.description}
                          {showProductCodes && item.code && (
                            <div className="sheet-item-code">{item.code}</div>
                          )}
                        </td>
                        <td className="center">{item.unit}</td>
                        <td className="number">{quantity.format(item.quantity)}</td>
                        <td className="number">{money.format(item.unitSale)}</td>
                        <td className="number">{money.format(item.totalSale)}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))
            : proposal.items.map((item) => {
                itemCounter += 1;
                return (
                  <tr key={item.id}>
                    <td className="center">{itemCounter}</td>
                    <td>
                      {item.description}
                      {showProductCodes && item.code && (
                        <div className="sheet-item-code">{item.code}</div>
                      )}
                    </td>
                    <td className="center">{item.unit}</td>
                    <td className="number">{quantity.format(item.quantity)}</td>
                    <td className="number">{money.format(item.unitSale)}</td>
                    <td className="number">{money.format(item.totalSale)}</td>
                  </tr>
                );
              })}

          {includeLabor && laborTotal > 0 && (
            <>
              <tr className="sheet-category-row">
                <td colSpan={6}>Serviços Técnicos</td>
              </tr>
              <tr className="sheet-labor-row">
                <td className="center">{++itemCounter}</td>
                <td>Execução e montagem técnica conforme escopo detalhado da proposta.</td>
                <td className="center">vb</td>
                <td className="number">1</td>
                <td className="number">{money.format(laborTotal)}</td>
                <td className="number">{money.format(laborTotal)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* 6. Resumo Financeiro */}
      <table className="sheet-summary-table">
        <tbody>
          {laborTotal > 0 ? (
            <>
              <tr>
                <th>Valor dos materiais e equipamentos</th>
                <td className="number">{money.format(materialsTotal)}</td>
              </tr>
              <tr>
                <th>Valor dos serviços técnicos</th>
                <td className="number">{money.format(laborTotal)}</td>
              </tr>
            </>
          ) : (
            <tr>
              <th>Subtotal dos itens e serviços</th>
              <td className="number">{money.format(total)}</td>
            </tr>
          )}
          <tr className="sheet-grand-total">
            <th>VALOR TOTAL DA PROPOSTA</th>
            <td className="number">{money.format(total)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
  const conditionsNode = (title: string) => (
    <>
      {/* 7. Condições Comerciais */}
      {includeCommercialTerms && (
        <div className="sheet-commercial-box">
          <div className="sheet-h2">{title}</div>
          <p className="sheet-term"><b>Forma de pagamento:</b> {conditions.paymentTerms || 'A definir'}</p>
          <p className="sheet-term"><b>Validade da proposta:</b> {validUntilFormatted}</p>
          <p className="sheet-term"><b>Prazo de execução:</b> {conditions.executionTerm || 'A definir'}</p>
          <p className="sheet-term"><b>Garantia:</b> {conditions.warranty || 'A definir'}</p>
          <p className="sheet-term">Valores expressos em moeda corrente nacional (BRL).</p>
        </div>
      )}

      {/* 8. Observações Técnicas */}
      {includeNotes && combinedNotes && (
        <div className="sheet-notes-box">
          <div className="sheet-h2">Observações Técnicas e Complementares</div>
          <p className="sheet-notes-text">{combinedNotes}</p>
        </div>
      )}
    </>
  );
  const hasLetter = Boolean(bodyParts?.some((part) => part.kind === 'carta'));
  const hasClosing = Boolean(bodyParts?.some((part) => part.kind === 'fechamento'));
  const bodyNode = (part: BodyPart, index: number) => {
    if (part.kind === 'itens') return <React.Fragment key={index}>{part.caption && <div className="sheet-caption">{part.caption}</div>}{pricingNode(part.title)}</React.Fragment>;
    if (part.kind === 'condicoes') return <React.Fragment key={index}>{conditionsNode(part.title)}</React.Fragment>;
    if (part.kind === 'carta') return <LetterPreview key={index} part={part} />;
    if (part.kind === 'fechamento') return <ClosingPreview key={index} part={part} company="LAC CONSTRUTEC CONSTRUTORA EIRELI" brand="CONSTRUTEC" showSignature />;
    if (part.kind === 'heading') return <div key={index} className={part.sub ? 'sheet-h3' : 'sheet-h2'}>{part.text}</div>;
    if (part.kind === 'paragraph') return <p key={index} className="sheet-copy" style={{ whiteSpace: 'pre-line' }}>{part.lines.join('\n')}</p>;
    return <ul key={index} className="sheet-copy">{part.items.map((item, at) => <li key={at}>{item}</li>)}</ul>;
  };

  return (
    <div className="paper-sheet authentic-timbrado">
      {/* 1. Cabeçalho Timbrado Oficial */}
      <header className="sheet-timbrado-header">
        <div className="sheet-timbrado-left">
          <img
            src={`data:image/png;base64,${CONSTRUTEC_LOGO_BASE64}`}
            alt="Construtec"
            className="sheet-timbrado-logo"
          />
          <div className="sheet-timbrado-company">
            <div className="sheet-timbrado-company-name">LAC CONSTRUTEC CONSTRUTORA EIRELI</div>
            <div>CNPJ: 32.992.946/0001-78</div>
            <div>Sede: Rua Metodio Coelho, 62, Ed. Cidadella Center I, Sala 112, Salvador/BA</div>
            <div>Contato: (71) 99294-1099 • supervisao@rcconstrutec.com.br</div>
          </div>
        </div>
        <div className="sheet-timbrado-right">
          <div className="sheet-timbrado-badge">PROPOSTA COMERCIAL</div>
          <div className="sheet-timbrado-doc-ref">{proposal.number}</div>
          <div className="sheet-timbrado-rev">Revisão {String(proposal.revision).padStart(2, '0')}</div>
          <div className="sheet-timbrado-date">{formattedDate}</div>
        </div>
      </header>

      {/* 2. Quadro de Identificação (a carta de abertura substitui o quadro e o título) */}
      {!hasLetter && <div className="sheet-identity-box">
        <table className="sheet-identity-table">
          <tbody>
            <tr>
              <td style={{ width: '60%' }}>
                <b>Cliente:</b> {proposal.clientName}
              </td>
              <td style={{ width: '40%' }}>
                <b>A/C:</b> {proposal.responsibleName || '-'}
              </td>
            </tr>
            <tr>
              <td>
                <b>Local / Obra:</b> {proposal.workName || '-'}
              </td>
              <td>
                <b>Referência:</b> {proposal.number} | Rev. {String(proposal.revision).padStart(2, '0')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>}

      {/* 3. Título e Preâmbulo */}
      {!hasLetter && <div className="sheet-h1">PROPOSTA TÉCNICA COMERCIAL</div>}
      {bodyParts ? bodyParts.map(bodyNode) : (
        <>
          {introNode}
          {pricingNode('2. Precificação')}
          {conditionsNode('3. Condições Comerciais')}
        </>
      )}

      {!hasClosing && (
        <p className="sheet-closing">
          Permanecemos à disposição para quaisquer esclarecimentos técnicos ou comerciais referentes a esta proposta.
        </p>
      )}

      {/* 9. Rodapé Timbrado Oficial */}
      <footer className="sheet-timbrado-footer">
        <div className="sheet-footer-line" />
        <div className="sheet-footer-meta">
          <div className="sheet-footer-company">LAC CONSTRUTEC CONSTRUTORA EIRELI</div>
          <div className="sheet-footer-page">Página 1 de 1</div>
        </div>
        <div className="sheet-footer-text">
          <b>Sede:</b> Rua Metodio Coelho, 62, EDIFICIO CIDADELLA CENTER  I, Sala 112/ PARQUE BELA VISTA/ Salvador BA /40050-450 • <b>Contato:</b> (71) 99294-1099
        </div>
        <div className="sheet-footer-text">
          <b>E-mail:</b> supervisao@rcconstrutec.com.br / engenharia@rcconstrutec.com.br
        </div>
      </footer>
    </div>
  );
};
