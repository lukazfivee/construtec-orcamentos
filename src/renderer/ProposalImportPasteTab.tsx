import { type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';

export interface ParsedSpreadsheetItem {
  code: string;
  description: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

interface ProposalImportPasteTabProps {
  pastedText: string;
  parsedItems: ParsedSpreadsheetItem[];
  onTextChange: (text: string) => void;
  onParsedItemsChange: (items: ParsedSpreadsheetItem[]) => void;
}

const parseCurrency = (val: string): number => {
  const clean = val.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!clean) return 0;
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0 ? num : 0;
};

export const parseSpreadsheetText = (rawText: string): ParsedSpreadsheetItem[] => {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const items: ParsedSpreadsheetItem[] = [];
  for (const line of lines) {
    const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length === 0 || !parts.some(Boolean)) continue;

    const firstLower = parts[0]?.toLowerCase() || '';
    if (firstLower === 'codigo' || firstLower === 'cód' || firstLower === 'item' || firstLower === 'descricao' || firstLower === 'descrição') {
      continue;
    }

    let code = '';
    let description = '';
    let quantity = 1;
    let unit = 'un';
    let unitCost = 0;

    if (parts.length === 1) {
      description = parts[0];
    } else if (parts.length === 2) {
      description = parts[0];
      quantity = Number(parts[1].replace(',', '.')) || 1;
    } else if (parts.length === 3) {
      code = parts[0];
      description = parts[1];
      quantity = Number(parts[2].replace(',', '.')) || 1;
    } else if (parts.length === 4) {
      code = parts[0];
      description = parts[1];
      quantity = Number(parts[2].replace(',', '.')) || 1;
      unit = parts[3] || 'un';
    } else {
      code = parts[0];
      description = parts[1];
      quantity = Number(parts[2].replace(',', '.')) || 1;
      unit = parts[3] || 'un';
      unitCost = parseCurrency(parts[4]);
    }

    if (description.length >= 2) {
      items.push({
        code,
        description,
        category: 'Importado',
        unit: unit || 'un',
        quantity: quantity > 0 ? quantity : 1,
        unitCost,
      });
    }
  }
  return items;
};

export function ProposalImportPasteTab({
  pastedText,
  parsedItems,
  onTextChange,
  onParsedItemsChange,
}: ProposalImportPasteTabProps) {
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onTextChange(content);
        onParsedItemsChange(parseSpreadsheetText(content));
      }
    };
    reader.readAsText(file);
  };

  const handleTextareaChange = (text: string) => {
    onTextChange(text);
    onParsedItemsChange(parseSpreadsheetText(text));
  };

  const totalCost = parsedItems.reduce((acc, it) => acc + it.quantity * it.unitCost, 0);

  return (
    <div className="import-tab-pane">
      <div className="paste-area-header">
        <span>Copie linhas do Excel/Google Sheets e cole abaixo ou selecione um arquivo:</span>
        <label className="csv-upload-btn">
          <Upload size={13} /> Carregar .CSV
          <input type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
      </div>

      <textarea
        className="paste-textarea"
        rows={4}
        value={pastedText}
        onChange={(e) => handleTextareaChange(e.target.value)}
        placeholder="Cole aqui (ex: CÓDIGO [tab] DESCRIÇÃO [tab] QUANTIDADE [tab] UNIDADE [tab] CUSTO)"
      />

      {parsedItems.length > 0 && (
        <div className="parsed-preview">
          <div className="preview-header">
            <strong>Pré-visualização: {parsedItems.length} item(ns) identificados</strong>
            <span className="preview-total">
              Total Custo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCost)}
            </span>
          </div>
          <div className="preview-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Qtd</th>
                  <th>Unid</th>
                  <th>Custo Unit.</th>
                  <th>Total Custo</th>
                </tr>
              </thead>
              <tbody>
                {parsedItems.slice(0, 50).map((it, idx) => (
                  <tr key={idx}>
                    <td><code>{it.code || '—'}</code></td>
                    <td>{it.description}</td>
                    <td>{it.quantity}</td>
                    <td>{it.unit}</td>
                    <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.unitCost)}</td>
                    <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.quantity * it.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
