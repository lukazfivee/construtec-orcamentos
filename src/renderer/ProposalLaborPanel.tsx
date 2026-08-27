import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ProposalLaborInput, ProposalLaborItem } from '../shared/contracts';
import { calculateLaborItem } from '../shared/labor';
import { proposalApi } from './api';
import './ProposalLaborPanel.css';

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyInput = (standardMonthlyHours: number): ProposalLaborInput => ({
  description: '',
  professionalCount: 1,
  monthlySalary: 0,
  monthlyFood: 0,
  monthlyTransport: 0,
  monthlyOtherCosts: 0,
  standardMonthlyHours,
  plannedHours: 0,
});

type Props = {
  proposalId: string;
  editable: boolean;
  onLaborTotalChange: (total: number) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

export function ProposalLaborPanel({ proposalId, editable, onLaborTotalChange, onError, onNotice }: Props) {
  const [items, setItems] = useState<ProposalLaborItem[]>([]);
  const [standardMonthlyHours, setStandardMonthlyHours] = useState(176);
  const [hoursDraft, setHoursDraft] = useState('176');
  const [form, setForm] = useState<ProposalLaborInput>(emptyInput(176));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const laborTotal = useMemo(() => items.reduce((sum, item) => sum + item.totalCost, 0), [items]);
  const formPreview = useMemo(() => {
    try {
      return calculateLaborItem(form);
    } catch {
      return { monthlyCost: 0, hourlyRate: 0, totalCost: 0 };
    }
  }, [form]);

  useEffect(() => {
    onLaborTotalChange(laborTotal);
  }, [laborTotal, onLaborTotalChange]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await proposalApi.labor(proposalId);
      setItems(result.items);
      setStandardMonthlyHours(result.standardMonthlyHours);
      setHoursDraft(String(result.standardMonthlyHours).replace('.', ','));
      setForm(emptyInput(result.standardMonthlyHours));
      setEditingId(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível carregar a mão de obra.');
    } finally {
      setLoading(false);
    }
  }, [onError, proposalId]);

  useEffect(() => { void load(); }, [load]);

  const updateNumber = (field: keyof ProposalLaborInput, value: string) => {
    const number = Number(value.replace(',', '.'));
    setForm((current) => ({ ...current, [field]: Number.isFinite(number) ? number : 0 }));
  };

  const startEdit = (item: ProposalLaborItem) => {
    setEditingId(item.id);
    setForm({
      description: item.description,
      professionalCount: item.professionalCount,
      monthlySalary: item.monthlySalary,
      monthlyFood: item.monthlyFood,
      monthlyTransport: item.monthlyTransport,
      monthlyOtherCosts: item.monthlyOtherCosts,
      standardMonthlyHours: item.standardMonthlyHours,
      plannedHours: item.plannedHours,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyInput(standardMonthlyHours));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editable || saving || form.description.trim().length < 2 || form.professionalCount <= 0 || form.standardMonthlyHours <= 0 || form.plannedHours < 0) return;
    setSaving(true);
    try {
      const wasEditing = Boolean(editingId);
      const result = editingId
        ? await proposalApi.updateLabor(proposalId, editingId, form)
        : await proposalApi.addLabor(proposalId, form);
      setItems(result.items);
      resetForm();
      onNotice(wasEditing ? 'Função de mão de obra atualizada.' : 'Função de mão de obra adicionada.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível salvar a mão de obra.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (itemId: string) => {
    if (!editable || saving) return;
    setSaving(true);
    try {
      const result = await proposalApi.removeLabor(proposalId, itemId);
      setItems(result.items);
      if (editingId === itemId) resetForm();
      onNotice('Função removida da mão de obra.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível remover a função.');
    } finally {
      setSaving(false);
    }
  };

  const saveDefaultHours = async () => {
    const hours = Number(hoursDraft.replace(',', '.'));
    if (!editable || !Number.isFinite(hours) || hours <= 0 || hours > 1000 || hours === standardMonthlyHours) {
      setHoursDraft(String(standardMonthlyHours).replace('.', ','));
      return;
    }
    setSaving(true);
    try {
      await proposalApi.updateLaborSettings(proposalId, hours);
      setStandardMonthlyHours(hours);
      if (!editingId) setForm((current) => ({ ...current, standardMonthlyHours: hours }));
      onNotice('Horas mensais padrão atualizadas para novos lançamentos.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível atualizar as horas mensais.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="labor-panel">
    <div className="labor-header">
      <div><h2>Mão de obra</h2><p>Calcule o custo por função usando salário, benefícios e horas previstas.</p></div>
      <label>Horas mensais padrão
        <input type="text" inputMode="decimal" value={hoursDraft} disabled={!editable || saving} onChange={(event) => setHoursDraft(event.target.value)} onBlur={() => void saveDefaultHours()} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      </label>
    </div>

    <form className="labor-form" onSubmit={(event) => void save(event)}>
      <label className="labor-description">Função / profissional<input value={form.description} disabled={!editable || saving} placeholder="Ex.: Técnico instalador" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
      <label>Qtd. profissionais<input type="number" min="0.01" step="0.01" value={form.professionalCount} disabled={!editable || saving} onChange={(event) => updateNumber('professionalCount', event.target.value)} /></label>
      <label>Salário mensal<input type="number" min="0" step="0.01" value={form.monthlySalary} disabled={!editable || saving} onChange={(event) => updateNumber('monthlySalary', event.target.value)} /></label>
      <label>Alimentação mensal<input type="number" min="0" step="0.01" value={form.monthlyFood} disabled={!editable || saving} onChange={(event) => updateNumber('monthlyFood', event.target.value)} /></label>
      <label>Transporte mensal<input type="number" min="0" step="0.01" value={form.monthlyTransport} disabled={!editable || saving} onChange={(event) => updateNumber('monthlyTransport', event.target.value)} /></label>
      <label>Outros custos mensais<input type="number" min="0" step="0.01" value={form.monthlyOtherCosts} disabled={!editable || saving} onChange={(event) => updateNumber('monthlyOtherCosts', event.target.value)} /></label>
      <label>Horas mensais<input type="number" min="0.01" step="0.01" value={form.standardMonthlyHours} disabled={!editable || saving} onChange={(event) => updateNumber('standardMonthlyHours', event.target.value)} /></label>
      <label>Horas previstas<input type="number" min="0" step="0.01" value={form.plannedHours} disabled={!editable || saving} onChange={(event) => updateNumber('plannedHours', event.target.value)} /></label>
      <div className="labor-preview" aria-label="Prévia do cálculo">
        <span><small>Custo mensal</small><b>R$ {money.format(formPreview.monthlyCost)}</b></span>
        <span><small>Valor hora</small><b>R$ {money.format(formPreview.hourlyRate)}</b></span>
        <span><small>Custo total</small><b>R$ {money.format(formPreview.totalCost)}</b></span>
      </div>
      <div className="labor-form-actions"><button className="primary compact" type="submit" disabled={!editable || saving || form.description.trim().length < 2}><Plus size={16} /> {editingId ? 'Salvar alteração' : 'Adicionar função'}</button>{editingId && <button type="button" disabled={saving} onClick={resetForm}>Cancelar edição</button>}</div>
    </form>

    <div className="table-region labor-table-region">
      <table className="labor-table">
        <thead><tr><th>Função</th><th>Prof.</th><th>Salário</th><th>Alimentação</th><th>Transporte</th><th>Outros</th><th>Custo mensal</th><th>Horas/mês</th><th>Valor hora</th><th>Horas previstas</th><th>Custo total</th><th /></tr></thead>
        <tbody>
          {items.map((item) => <tr key={item.id} onDoubleClick={() => editable && startEdit(item)}>
            <td><button className="labor-edit-link" type="button" disabled={!editable} onClick={() => startEdit(item)}>{item.description}</button></td>
            <td className="number">{money.format(item.professionalCount)}</td>
            <td className="number">{money.format(item.monthlySalary)}</td>
            <td className="number">{money.format(item.monthlyFood)}</td>
            <td className="number">{money.format(item.monthlyTransport)}</td>
            <td className="number">{money.format(item.monthlyOtherCosts)}</td>
            <td className="number"><b>{money.format(item.monthlyCost)}</b></td>
            <td className="number">{money.format(item.standardMonthlyHours)}</td>
            <td className="number">{money.format(item.hourlyRate)}</td>
            <td className="number">{money.format(item.plannedHours)}</td>
            <td className="number"><b>{money.format(item.totalCost)}</b></td>
            <td><button className="icon-button" type="button" aria-label={`Excluir ${item.description}`} disabled={!editable || saving} onClick={() => void remove(item.id)}><Trash2 size={15} /></button></td>
          </tr>)}
          {!loading && items.length === 0 && <tr className="empty-row"><td colSpan={12}>Nenhuma função cadastrada. Preencha os campos acima para calcular a mão de obra.</td></tr>}
          {loading && <tr className="empty-row"><td colSpan={12}>Carregando composição de mão de obra…</td></tr>}
        </tbody>
        <tfoot><tr><td colSpan={10}>Total de mão de obra</td><td className="number"><b>R$ {money.format(laborTotal)}</b></td><td /></tr></tfoot>
      </table>
    </div>
  </div>;
}
