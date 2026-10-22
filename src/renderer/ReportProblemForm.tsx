import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Send } from './icons';
import { apiRequest } from './api';
import './ReportProblemForm.css';

const TYPES = [['bug', 'Problema (bug)'], ['melhoria', 'Melhoria'], ['sugestao', 'Sugestão']] as const;
const SEVERITIES = [['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta'], ['critica', 'Crítica']] as const;

// Reporte de problema, melhoria ou sugestao: o servidor manda ao suporte (pcm@rcconstrutec.com.br) com o nome e o e-mail da sessao.
export function ReportProblemForm() {
  const [type, setType] = useState<string>('bug');
  const [severity, setSeverity] = useState<string>('media');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentId, setSentId] = useState<string | null>(null);

  const valid = title.trim().length >= 3 && description.trim().length >= 5;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    setError('');
    try {
      const result = await apiRequest<{ reportId: string }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          type, severity, title: title.trim(), description: description.trim(),
          platform: window.construtec?.restoreBackup ? 'desktop' : 'navegador',
        }),
      });
      setSentId(result.reportId || 'enviado');
      setTitle('');
      setDescription('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível enviar o report.');
    } finally {
      setSending(false);
    }
  };

  if (sentId) {
    return (
      <div className="help-section report-form-done" role="status">
        <CheckCircle2 size={28} />
        <strong>Report enviado ao suporte</strong>
        {sentId !== 'enviado' && <span>Protocolo {sentId}</span>}
        <button type="button" className="secondary compact" onClick={() => setSentId(null)}>Enviar outro</button>
      </div>
    );
  }

  return (
    <form className="help-section report-form" onSubmit={(event) => void submit(event)}>
      <p className="help-section-desc">
        Conte o que aconteceu ou o que poderia melhorar. O suporte recebe seu nome e e-mail para responder. Não escreva senhas.
      </p>
      <div className="report-form-row">
        <label>
          <span>Tipo</span>
          <select value={type} onChange={(event) => setType(event.target.value)} disabled={sending}>
            {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Prioridade</span>
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} disabled={sending}>
            {SEVERITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label>
        <span>Título</span>
        <input type="text" maxLength={170} value={title} disabled={sending} onChange={(event) => setTitle(event.target.value)} placeholder="Resumo em uma frase" />
      </label>
      <label>
        <span>Descrição</span>
        <textarea rows={6} maxLength={10000} value={description} disabled={sending} onChange={(event) => setDescription(event.target.value)} placeholder="O que você fez, o que esperava e o que aconteceu" />
      </label>
      {error && <div className="report-form-error" role="alert">{error}</div>}
      <div className="report-form-actions">
        <button type="submit" className="primary compact" disabled={!valid || sending}>
          <Send size={15} /> {sending ? 'Enviando…' : 'Enviar ao suporte'}
        </button>
      </div>
    </form>
  );
}
