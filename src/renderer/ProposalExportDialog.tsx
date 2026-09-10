import { useEffect, useState } from 'react';
import { Eye, FileCheck2, FileText, Layers, Loader2, Printer, Sparkles, X } from 'lucide-react';
import { getProposalFinancials } from '../shared/proposalFinancials';
import type { ProposalDetail, ProposalExportOptions } from '../shared/contracts';
import { ProposalPreviewSheet } from './ProposalPreviewSheet';

interface Props {
  open: boolean;
  proposal: ProposalDetail | null;
  onClose: () => void;
  onExportSuccess: (files: string[]) => void;
  onError: (message: string) => void;
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProposalExportDialog({
  open,
  proposal,
  onClose,
  onExportSuccess,
  onError,
}: Props) {
  const [format, setFormat] = useState<'both' | 'pdf' | 'docx'>('both');
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [showProductCodes, setShowProductCodes] = useState(true);
  const [includeLabor, setIncludeLabor] = useState(true);
  const [includeCommercialTerms, setIncludeCommercialTerms] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [customNotes, setCustomNotes] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isExporting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isExporting, onClose]);

  if (!open || !proposal) return null;

  const exportOptions: ProposalExportOptions = {
    format,
    groupByCategory,
    showProductCodes,
    includeLabor,
    includeCommercialTerms,
    includeNotes,
    customNotes: customNotes.trim(),
  };

  const handlePreview = async () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    try {
      if (window.construtec?.previewProposal) {
        await window.construtec.previewProposal(proposal, exportOptions);
      } else {
        window.print();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao abrir pré-visualização.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      if (window.construtec?.exportProposal) {
        const result = await window.construtec.exportProposal(proposal, exportOptions);
        if (!result.canceled) {
          onExportSuccess(result.files);
          onClose();
        }
      } else {
        window.print();
        onClose();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao exportar documentos.');
    } finally {
      setIsExporting(false);
    }
  };

  const laborTotal = (proposal.totals.labor ?? 0) * proposal.bdiMultiplier;
  const grandTotal = getProposalFinancials(proposal).finalValue;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="proposal-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="export-dialog-header">
          <div className="title-area">
            <FileCheck2 size={22} className="export-icon" />
            <div>
              <h2 id="export-dialog-title">Emissão e Personalização de Documentos</h2>
              <p>Proposta <b>{proposal.number}</b> • REV.{String(proposal.revision).padStart(2, '0')} — {proposal.clientName} • Total: {money.format(grandTotal)}</p>
            </div>
          </div>
          <button type="button" className="dialog-close" aria-label="Fechar" onClick={onClose} disabled={isExporting}>
            <X size={18} />
          </button>
        </header>

        <div className="export-dialog-body">
          {/* Settings Panel */}
          <div className="export-settings-panel">
            <h3><Sparkles size={15} /> Formato de Emissão</h3>
            <div className="format-options-grid">
              <label className={`format-card ${format === 'both' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="both"
                  checked={format === 'both'}
                  onChange={() => setFormat('both')}
                />
                <FileCheck2 size={18} />
                <span>
                  <strong>PDF + Word</strong>
                  <small>Pacote completo para envio e edição</small>
                </span>
              </label>

              <label className={`format-card ${format === 'pdf' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="pdf"
                  checked={format === 'pdf'}
                  onChange={() => setFormat('pdf')}
                />
                <Printer size={18} />
                <span>
                  <strong>Apenas PDF</strong>
                  <small>Documento timbrado pronto para o cliente</small>
                </span>
              </label>

              <label className={`format-card ${format === 'docx' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="docx"
                  checked={format === 'docx'}
                  onChange={() => setFormat('docx')}
                />
                <FileText size={18} />
                <span>
                  <strong>Apenas Word</strong>
                  <small>Arquivo .docx editável</small>
                </span>
              </label>
            </div>

            <h3><Layers size={15} /> Opções de Apresentação</h3>
            <div className="options-checkboxes">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={groupByCategory}
                  onChange={(e) => setGroupByCategory(e.target.checked)}
                />
                <span>Agrupar itens por categoria técnica (Elétrica, CFTV, etc.)</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showProductCodes}
                  onChange={(e) => setShowProductCodes(e.target.checked)}
                />
                <span>Exibir códigos técnicos de catálogo abaixo da descrição</span>
              </label>

              {laborTotal > 0 && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={includeLabor}
                    onChange={(e) => setIncludeLabor(e.target.checked)}
                  />
                  <span>Incluir composição e serviços técnicos ({money.format(laborTotal)})</span>
                </label>
              )}

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={includeCommercialTerms}
                  onChange={(e) => setIncludeCommercialTerms(e.target.checked)}
                />
                <span>Incluir cláusulas comerciais (Validade, Prazo, Pagamento, Garantia)</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                />
                <span>Incluir observações e recomendações técnicas</span>
              </label>
            </div>

            {includeNotes && (
              <div className="custom-notes-area">
                <label htmlFor="export-custom-notes">
                  Observações complementares para este documento:
                </label>
                <textarea
                  id="export-custom-notes"
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Ex: Não inclusa infraestrutura de alvenaria. Ponto de energia por conta do contratante."
                />
              </div>
            )}
          </div>

          {/* Live Document Paper Preview */}
          <div className="export-preview-panel">
            <div className="preview-label">
              <span>Folha A4 Timbrada Oficial (Prévia em tempo real)</span>
              <span className="page-indicator">Página 1 de 1</span>
            </div>

            <ProposalPreviewSheet
              proposal={proposal}
              groupByCategory={groupByCategory}
              showProductCodes={showProductCodes}
              includeLabor={includeLabor}
              includeCommercialTerms={includeCommercialTerms}
              includeNotes={includeNotes}
              customNotes={customNotes}
            />
          </div>
        </div>

        <footer className="export-dialog-footer">
          <div className="footer-tip">
            {format === 'both' ? 'Serão gerados os arquivos .pdf e .docx na pasta que você selecionar.' : format === 'pdf' ? 'Será gerado o arquivo .pdf oficial.' : 'Será gerado o arquivo .docx editável.'}
          </div>
          <div className="footer-buttons">
            <button type="button" onClick={onClose} disabled={isExporting || isPreviewing}>
              Cancelar
            </button>
            <button type="button" className="btn-preview" onClick={handlePreview} disabled={isExporting || isPreviewing}>
              {isPreviewing ? <Loader2 className="spinning" size={15} /> : <Eye size={15} />}
              Visualizar em Tela Cheia
            </button>
            <button type="button" className="primary btn-export" onClick={handleExport} disabled={isExporting || isPreviewing}>
              {isExporting ? <Loader2 className="spinning" size={15} /> : <FileCheck2 size={15} />}
              {isExporting ? 'Exportando…' : 'Salvar Documentos'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
