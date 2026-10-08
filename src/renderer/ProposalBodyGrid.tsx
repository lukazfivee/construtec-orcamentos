// Editor da planilha propria dentro do cartao do corpo: cabecalho, linhas e colunas digitados ou colados do Excel.
// A grade usa a largura toda do cartao (sem rolagem propria): as colunas dividem o espaco por igual.
import { useState, type ClipboardEvent } from 'react';
import { ClipboardPaste, Plus, X } from 'lucide-react';
import { BODY_LIMITS, emptyBodyTable, type BodyTable } from '../shared/proposalBody';
import {
  addColumn, addRow, canAddColumn, canAddRow, canRemoveColumn, isTablePaste, parseClipboardTable, pasteInto, removeColumn, removeRow, setCell, setHeader, tableFromPaste,
} from './bodyGridOps';

type Props = { id: string; table: BodyTable | undefined; editable: boolean; onChange: (table: BodyTable) => void };

export function ProposalBodyGrid({ id, table: value, editable, onChange }: Props) {
  const table = value ?? emptyBodyTable();
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const template = `repeat(${table.headers.length}, minmax(0, 1fr)) 32px`;

  // Varias celulas copiadas do Excel espalham a partir da celula escolhida; texto simples cola normalmente.
  const onPaste = (event: ClipboardEvent<HTMLInputElement>, row: number, column: number) => {
    const text = event.clipboardData.getData('text');
    if (!editable || !isTablePaste(text)) return;
    const cells = parseClipboardTable(text);
    if (cells.length === 0) return;
    event.preventDefault();
    onChange(pasteInto(table, row, column, cells));
  };

  const usePasted = () => {
    const next = tableFromPaste(parseClipboardTable(pasted));
    if (!next) return;
    onChange(next);
    setPasted('');
    setPasting(false);
  };

  return (
    <div className="body-grid" role="group" aria-label="Planilha">
      <div className="body-grid-head" style={{ gridTemplateColumns: template }}>
        {table.headers.map((header, column) => (
          <span key={column} className="body-grid-col">
            <input
              id={column === 0 ? `body-grid-${id}` : undefined} type="text" value={header} maxLength={BODY_LIMITS.tableCell} disabled={!editable}
              placeholder={`Coluna ${column + 1}`} aria-label={`Título da coluna ${column + 1}`}
              onChange={(event) => onChange(setHeader(table, column, event.currentTarget.value))} onPaste={(event) => onPaste(event, -1, column)}
            />
            {editable && canRemoveColumn(table) && (
              <button type="button" className="body-grid-x" aria-label={`Remover coluna ${column + 1}`} title="Remover coluna" onClick={() => onChange(removeColumn(table, column))}><X size={13} /></button>
            )}
          </span>
        ))}
        <span aria-hidden="true" />
      </div>
      {table.rows.map((row, at) => (
        <div key={at} className="body-grid-row" style={{ gridTemplateColumns: template }}>
          {row.map((cell, column) => (
            <input
              key={column} type="text" value={cell} maxLength={BODY_LIMITS.tableCell} disabled={!editable}
              aria-label={`Linha ${at + 1}, ${table.headers[column] || `coluna ${column + 1}`}`}
              onChange={(event) => onChange(setCell(table, at, column, event.currentTarget.value))} onPaste={(event) => onPaste(event, at, column)}
            />
          ))}
          {editable
            ? <button type="button" className="body-icon danger" aria-label={`Remover linha ${at + 1}`} title="Remover linha" onClick={() => onChange(removeRow(table, at))}><X size={15} /></button>
            : <span aria-hidden="true" />}
        </div>
      ))}
      {editable && (
        <div className="body-grid-tools">
          <button type="button" className="body-btn" disabled={!canAddRow(table)} onClick={() => onChange(addRow(table))}><Plus size={15} />Linha</button>
          <button type="button" className="body-btn" disabled={!canAddColumn(table)} onClick={() => onChange(addColumn(table))}><Plus size={15} />Coluna</button>
          <button type="button" className="body-link" aria-expanded={pasting} onClick={() => setPasting((open) => !open)}><ClipboardPaste size={15} />Colar do Excel</button>
          <span className="body-count">{table.rows.length} {table.rows.length === 1 ? 'linha' : 'linhas'} · {table.headers.length} {table.headers.length === 1 ? 'coluna' : 'colunas'} (até {BODY_LIMITS.tableRows} × {BODY_LIMITS.tableCols})</span>
        </div>
      )}
      {editable && pasting && (
        <div className="body-grid-paste">
          <label className="body-field">Copie as células no Excel e cole aqui. A primeira linha vira o título das colunas.
            <textarea value={pasted} rows={5} placeholder="Cole aqui as células copiadas" onChange={(event) => setPasted(event.currentTarget.value)} />
          </label>
          <span className="body-naming">
            <button type="button" className="body-btn primary" disabled={!tableFromPaste(parseClipboardTable(pasted))} onClick={usePasted}>Usar como planilha</button>
            <button type="button" className="body-btn" onClick={() => { setPasting(false); setPasted(''); }}>Cancelar</button>
          </span>
          <small className="body-note">Isso troca a planilha atual. Dica: também dá para colar direto numa célula da grade, que as demais se espalham a partir dela.</small>
        </div>
      )}
      <p className="body-note">Texto livre, sem cálculo: a planilha não entra no valor da proposta. Colunas só de números e valores ficam alinhadas à direita.</p>
    </div>
  );
}
