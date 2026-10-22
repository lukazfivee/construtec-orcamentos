import { useEffect, useState } from 'react';
import { Eye, FileCheck2, FileText, Layers, Loader2, Printer, Sparkles } from 'lucide-react';
import { brl } from '../shared/formatoBr';
import { getProposalFinancials } from '../shared/proposalFinancials';
import type { ProposalDetail, ProposalExportOptions } from '../shared/contracts';
import { buildProposalDocxBlob, buildProposalHtml, proposalFileBaseName } from '../documents/proposalDocument';
import { Dialogo } from './orcDeskUi';
import { settingsApi } from './api';
import { ProposalPreviewSheet } from './ProposalPreviewSheet';

interface Props {
  open: boolean;
  proposal: ProposalDetail | null;
  onClose: () => void;
  onExportSuccess: (files: string[]) => void;
  onError: (message: string) => void;
}

const printDocumentHtml = (html: string, title: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      const appTitle = document.title;
      const restore = () => { document.title = appTitle; };
      document.title = title;
      iframe.contentWindow?.addEventListener('afterprint', restore);
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { restore(); iframe.remove(); }, 60000);
    }, 350);
  }
};

const downloadDocxBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Configuracoes da empresa (logo, assinatura, dados) para o documento; sem rede o documento sai com os padroes.
const loadSettings = () => settingsApi.get().then((result) => result.settings).catch(() => undefined);

export function ProposalExportDialog({
  open,
  proposal,
  onClose,
  onExportSuccess,
  onError,
}: Props) {
  const [format, setFormat] = useState<'both' | 'pdf' | 'docx'>('both');
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [showProductCodes, setShowProductCodes] = useState(false);
  const [includeLabor, setIncludeLabor] = useState(true);
  const [includeCommercialTerms, setIncludeCommercialTerms] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [customNotes, setCustomNotes] = useState('');
  const [watermark, setWatermark] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // A marca d'agua comeca no padrao da empresa; quem exporta pode ligar ou desligar so desta vez.
  useEffect(() => {
    if (!open) return;
    void loadSettings().then((settings) => { if (settings) setWatermark(settings.pdfWatermark === true); });
  }, [open]);

  if (!open || !proposal) return null;

  const exportOptions: ProposalExportOptions = {
    format,
    groupByCategory,
    showProductCodes,
    includeLabor,
    includeCommercialTerms,
    includeNotes,
    customNotes: customNotes.trim(),
    watermark,
  };

  const handlePreview = async () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    try {
      if (window.construtec?.previewProposal) {
        await window.construtec.previewProposal(proposal, exportOptions);
      } else {
        const html = buildProposalHtml(proposal, await loadSettings(), exportOptions);
        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(html);
          win.document.close();
        }
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
        const baseName = proposalFileBaseName(proposal);
        const files: string[] = [];

        if (format === 'docx' || format === 'both') {
          const blob = await buildProposalDocxBlob(proposal, await loadSettings(), exportOptions);
          const docxName = `${baseName}.docx`;
          downloadDocxBlob(blob, docxName);
          files.push(docxName);
        }

        if (format === 'pdf' || format === 'both') {
          const html = buildProposalHtml(proposal, await loadSettings(), exportOptions);
          printDocumentHtml(html, baseName);
          files.push(`${baseName}.pdf`);
        }

        onExportSuccess(files);
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
    <Dialogo
      id="export-dialog"
      icon={FileCheck2}
      title="Exportar documentos"
      sub={`${proposal.number} · REV.${String(proposal.revision).padStart(2, '0')} · ${proposal.clientName} · ${brl(grandTotal)}`}
      className="w-xl export-dlg"
      busy={isExporting}
      onClose={onClose}
      footer={(
        <>
          <span className="dlg-tip">
            {format === 'both' ? 'Gera os arquivos .pdf e .docx na pasta que você escolher.' : format === 'pdf' ? 'Gera o arquivo .pdf.' : 'Gera o arquivo .docx editável.'}
          </span>
          <button type="button" onClick={onClose} disabled={isExporting || isPreviewing}>Cancelar</button>
          <button type="button" onClick={handlePreview} disabled={isExporting || isPreviewing}>
            {isPreviewing ? <Loader2 className="spinning" size={16} /> : <Eye size={16} />}
            Ver em tela cheia
          </button>
          <button type="button" className="primary" onClick={handleExport} disabled={isExporting || isPreviewing}>
            {isExporting ? <Loader2 className="spinning" size={16} /> : <FileCheck2 size={16} />}
            {isExporting ? 'Exportando…' : 'Salvar documentos'}
          </button>
        </>
      )}
    >
        <div className="export-dialog-body">
          {/* Settings Panel */}
          <div className="export-settings-panel">
            <h3><Sparkles size={16} /> Formato</h3>
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
                  <small>Para enviar e editar</small>
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
                  <strong>Só PDF</strong>
                  <small>Pronto para o cliente</small>
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
                  <strong>Só Word</strong>
                  <small>Arquivo .docx editável</small>
                </span>
              </label>
            </div>

            <h3><Layers size={16} /> O que entra no documento</h3>
            <div className="options-checkboxes">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={groupByCategory}
                  onChange={(e) => setGroupByCategory(e.target.checked)}
                />
                <span>Agrupar itens por categoria (Elétrica, CFTV…)</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showProductCodes}
                  onChange={(e) => setShowProductCodes(e.target.checked)}
                />
                <span>Códigos do catálogo abaixo da descrição</span>
              </label>

              <label className="checkbox-row">
                <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />
                <span>Marca d'água com a logo ao fundo das páginas</span>
              </label>

              {laborTotal > 0 && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={includeLabor}
                    onChange={(e) => setIncludeLabor(e.target.checked)}
                  />
                  <span>Mão de obra e serviços técnicos ({brl(laborTotal)})</span>
                </label>
              )}

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={includeCommercialTerms}
                  onChange={(e) => setIncludeCommercialTerms(e.target.checked)}
                />
                <span>Condições comerciais (validade, prazo, pagamento, garantia)</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                />
                <span>Observações e recomendações técnicas</span>
              </label>
            </div>

            {includeNotes && (
              <div className="custom-notes-area">
                <label htmlFor="export-custom-notes">
                  Observações só deste documento
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
              <span>Prévia da primeira folha</span>
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
    </Dialogo>
  );
}
