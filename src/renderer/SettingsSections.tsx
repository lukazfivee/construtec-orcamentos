import type { ReactNode } from 'react';
import type { AppSettings } from '../shared/contracts';
import { version as appVersion } from '../../package.json';
import type { LucideIcon } from './icons';
import { Building2, Database, Download, Percent, Upload } from './icons';
import { isCloudRuntime } from './api';

/* Cartoes de Configuracoes com as proporcoes do Centro de Custos (cartao raio 14, titulo 15/600, campos de 40 px). */
export function SettingsCard({ icon: Icon, title, sub, children }: { icon: LucideIcon; title: string; sub: string; children: ReactNode }) {
  return (
    <section className="od-card st-card">
      <div className="st-head">
        <span className="st-ic"><Icon size={18} strokeWidth={1.5} /></span>
        <div><h2>{title}</h2><p>{sub}</p></div>
      </div>
      {children}
    </section>
  );
}

type FormProps = { settings: AppSettings; disabled: boolean; onChange: (next: AppSettings) => void };
type TextKey = 'companyName' | 'tradeName' | 'document' | 'email' | 'phone' | 'address';

export function CompanyDataCard({ settings, disabled, onChange }: FormProps) {
  const text = (key: TextKey, label: string, placeholder: string, wide = false, type = 'text') => (
    <label className={`od-fld${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      <input className="od-inp" type={type} disabled={disabled} value={settings[key]} placeholder={placeholder} onChange={(e) => onChange({ ...settings, [key]: e.target.value })} />
    </label>
  );
  return (
    <SettingsCard icon={Building2} title="Dados da empresa nos documentos" sub="Identificação oficial que estampa cabeçalhos e rodapés de documentos PDF e Word.">
      <div className="st-grid">
        {text('companyName', 'Razão Social', 'Construtec Engenharia e Soluções Ltda.', true)}
        {text('tradeName', 'Nome Fantasia / Marca', 'Construtec Engenharia')}
        {text('document', 'CNPJ / Inscrição', '00.000.000/0001-00')}
        {text('email', 'E-mail comercial', 'comercial@construtec.com.br', false, 'email')}
        {text('phone', 'Telefone de contato', '(11) 99999-9999')}
        {text('address', 'Endereço / Cidade', 'São Paulo - SP', true)}
      </div>
    </SettingsCard>
  );
}

export function NewProposalParamsCard({ settings, disabled, onChange }: FormProps) {
  return (
    <SettingsCard icon={Percent} title="Padrões das novas propostas" sub="Responsável e horas da mão de obra. BDI, impostos e validade ficam em Padrões da empresa.">
      <div className="st-grid">
        <label className="od-fld">
          <span>Responsável técnico padrão</span>
          <input className="od-inp" disabled={disabled} value={settings.defaultResponsible} placeholder="Marcos Ribeiro" onChange={(e) => onChange({ ...settings, defaultResponsible: e.target.value })} />
        </label>
        <label className="od-fld">
          <span>Horas por mês da mão de obra</span>
          <input className="od-inp" disabled={disabled} type="number" step="1" min="1" max="720" value={settings.defaultStandardHours} onChange={(e) => onChange({ ...settings, defaultStandardHours: Number(e.target.value) })} />
        </label>
      </div>
    </SettingsCard>
  );
}

type EnvProps = { isAdmin: boolean; backupPending: boolean; restorePending: boolean; onBackup: () => void; onRestore: () => void };

export function EnvironmentCard({ isAdmin, backupPending, restorePending, onBackup, onRestore }: EnvProps) {
  const cloud = isCloudRuntime();
  return (
    <SettingsCard icon={Database} title="Ambiente e armazenamento" sub={cloud ? 'Os dados desta versão ficam na nuvem, num banco PostgreSQL.' : 'Os dados desta versão ficam neste computador e funcionam sem internet.'}>
      <div className="st-tiles">
        <div className="st-tile"><span>Versão do app</span><b>v{appVersion}</b></div>
        <div className="st-tile"><span>Banco de dados</span><b>{cloud ? 'PostgreSQL na nuvem' : 'PGlite neste computador'}</b></div>
        <div className="st-tile"><span>Modo de operação</span><b>{cloud ? 'On-line' : 'Sem internet (local)'}</b></div>
      </div>
      {isAdmin && (
        <div className="st-actions">
          <div className="st-action">
            <div><b>Backup do banco local</b><span>Gera um tar.gz consistente pelo mecanismo oficial do PGlite. O arquivo pode ser guardado fora deste computador.</span></div>
            <button type="button" className="od-btn s" onClick={onBackup} disabled={backupPending || restorePending}>
              <Download size={17} strokeWidth={1.5} /> {backupPending ? 'Gerando…' : 'Criar backup'}
            </button>
          </div>
          <div className="st-action">
            <div><b>Restaurar banco local</b><span>Valida o backup antes da troca, cria uma cópia de emergência do banco atual e reinicia o aplicativo.</span></div>
            <button type="button" className="od-btn s" onClick={onRestore} disabled={backupPending || restorePending}>
              <Upload size={17} strokeWidth={1.5} /> {restorePending ? 'Validando…' : 'Restaurar backup'}
            </button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
