import { useEffect, useState, type FormEvent } from 'react';
import {
  Building2,
  Database,
  Download,
  KeyRound,
  Percent,
  Save,
  Settings,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AppSettings, AuthRole, AuthUser, UserRecord } from '../shared/contracts';
import { authApi, settingsApi, systemApi, usersApi } from './api';

type SettingsWorkspaceProps = {
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

type NewUserDraft = {
  name: string;
  email: string;
  password: string;
  role: AuthRole;
};

const initialSettings: AppSettings = {
  companyName: 'Construtec Engenharia Ltda.',
  tradeName: 'Construtec Engenharia',
  document: '',
  phone: '',
  email: 'comercial@construtec.local',
  address: '',
  defaultResponsible: 'Marcos Ribeiro',
  defaultBdi: 1.45,
  defaultStandardHours: 176,
  defaultValidityDays: 15,
};

const emptyUser: NewUserDraft = { name: '', email: '', password: '', role: 'commercial' };
const roleLabels: Record<AuthRole, string> = { admin: 'Administrador', commercial: 'Comercial', viewer: 'Consulta' };

export function SettingsWorkspace({ onNotice, onError }: SettingsWorkspaceProps) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [newUser, setNewUser] = useState<NewUserDraft>(emptyUser);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userPending, setUserPending] = useState(false);
  const [backupPending, setBackupPending] = useState(false);
  const [restorePending, setRestorePending] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const [settingsResult, meResult] = await Promise.all([settingsApi.get(), authApi.me()]);
        if (!active) return;
        setSettings(settingsResult.settings);
        setCurrentUser(meResult.user);
        if (meResult.user.role === 'admin') {
          const usersResult = await usersApi.list();
          if (active) setUsers(usersResult.users);
        }
      } catch (error) {
        if (active) onError(error instanceof Error ? error.message : 'Não foi possível carregar as configurações.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !isAdmin) return;

    setSaving(true);
    try {
      const result = await settingsApi.update(settings);
      setSettings(result.settings);
      onNotice('Configurações salvas com sucesso.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    if (userPending || !isAdmin) return;
    setUserPending(true);
    try {
      const result = await usersApi.create(newUser);
      setUsers(result.users);
      setNewUser(emptyUser);
      onNotice('Usuário criado com sucesso.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível criar o usuário.');
    } finally {
      setUserPending(false);
    }
  };

  const updateUserDraft = (userId: string, changes: Partial<UserRecord>) => {
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, ...changes } : user));
  };

  const saveUser = async (user: UserRecord) => {
    if (userPending || !isAdmin) return;
    setUserPending(true);
    try {
      const result = await usersApi.update(user.id, {
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      });
      setUsers(result.users);
      onNotice('Usuário atualizado.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível atualizar o usuário.');
      try {
        const result = await usersApi.list();
        setUsers(result.users);
      } catch { /* mantém o erro original */ }
    } finally {
      setUserPending(false);
    }
  };

  const resetPassword = async (user: UserRecord) => {
    const password = passwordDrafts[user.id] ?? '';
    if (userPending || !isAdmin || password.length < 10) {
      onError('Informe uma nova senha com pelo menos 10 caracteres.');
      return;
    }
    setUserPending(true);
    try {
      await usersApi.resetPassword(user.id, password);
      setPasswordDrafts((current) => ({ ...current, [user.id]: '' }));
      onNotice(`Senha de ${user.name} redefinida.`);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível redefinir a senha.');
    } finally {
      setUserPending(false);
    }
  };

  const createBackup = async () => {
    if (backupPending || restorePending || !isAdmin) return;
    if (!window.construtec?.saveBackup) {
      onError('O recurso de backup só está disponível no aplicativo desktop.');
      return;
    }
    setBackupPending(true);
    try {
      const bytes = await systemApi.createBackup();
      if (bytes.byteLength === 0) throw new Error('O backup gerado está vazio.');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const result = await window.construtec.saveBackup(bytes, `Construtec-Orcamentos-backup-${stamp}.tar.gz`);
      if (!result.canceled) onNotice('Backup do banco local salvo com sucesso.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível gerar o backup local.');
    } finally {
      setBackupPending(false);
    }
  };

  const restoreBackup = async () => {
    if (restorePending || backupPending || !isAdmin) return;
    setRestorePending(true);
    try {
      const result = await systemApi.restoreBackup();
      if (!result.canceled && !result.restarting) onNotice('Backup validado.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível restaurar o backup local.');
    } finally {
      setRestorePending(false);
    }
  };

  const settingDisabled = loading || !isAdmin;

  return (
    <main className="management-workspace settings-workspace">
      <header className="management-header">
        <div>
          <Settings size={25} />
          <span>
            <h1>Configurações</h1>
            <p>Parâmetros da empresa, padrões de propostas, usuários e estado do sistema.</p>
          </span>
        </div>
        <span className="management-header-actions">
          <button type="submit" form="settings-form" className="primary" disabled={saving || settingDisabled} title={!isAdmin ? 'Somente administradores podem alterar configurações.' : undefined}>
            <Save size={16} /> {saving ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </span>
      </header>

      <div className="settings-body" style={{ padding: '24px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '980px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {!loading && !isAdmin && (
            <div className="dialog-warning" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={15} /> Configurações abertas em modo de consulta. Apenas administradores podem alterar estes dados.
            </div>
          )}

          <form id="settings-form" onSubmit={(e) => void saveSettings(e)} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="settings-card" style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #f0f2f5', paddingBottom: '12px' }}>
                <Building2 size={19} color="#085ce5" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Dados da Construtec para Exportação</h2>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#697386' }}>Identificação oficial que estampa cabeçalhos e rodapés de documentos PDF e Word.</p>
                </div>
              </div>

              <div className="form-grid">
                <label className="wide"><span>Razão Social</span><input disabled={settingDisabled} value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} placeholder="Construtec Engenharia e Soluções Ltda." /></label>
                <label><span>Nome Fantasia / Marca</span><input disabled={settingDisabled} value={settings.tradeName} onChange={(e) => setSettings({ ...settings, tradeName: e.target.value })} placeholder="Construtec Engenharia" /></label>
                <label><span>CNPJ / Inscrição</span><input disabled={settingDisabled} value={settings.document} onChange={(e) => setSettings({ ...settings, document: e.target.value })} placeholder="00.000.000/0001-00" /></label>
                <label><span>E-mail comercial</span><input disabled={settingDisabled} type="email" value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} placeholder="comercial@construtec.com.br" /></label>
                <label><span>Telefone de contato</span><input disabled={settingDisabled} value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} placeholder="(11) 99999-9999" /></label>
                <label className="wide"><span>Endereço / Cidade</span><input disabled={settingDisabled} value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} placeholder="São Paulo - SP" /></label>
              </div>
            </div>

            <div className="settings-card" style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #f0f2f5', paddingBottom: '12px' }}>
                <Percent size={19} color="#085ce5" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Parâmetros Padrão de Novas Propostas</h2>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#697386' }}>Valores iniciais aplicados automaticamente ao criar orçamentos.</p>
                </div>
              </div>

              <div className="form-grid">
                <label><span>Responsável Técnico Padrão</span><input disabled={settingDisabled} value={settings.defaultResponsible} onChange={(e) => setSettings({ ...settings, defaultResponsible: e.target.value })} placeholder="Marcos Ribeiro" /></label>
                <label><span>Multiplicador BDI Padrão (ex: 1.45 para 45%)</span><input disabled={settingDisabled} type="number" step="0.01" min="1" max="10" value={settings.defaultBdi} onChange={(e) => setSettings({ ...settings, defaultBdi: Number(e.target.value) })} /></label>
                <label><span>Horas Mensais Padrão (Mão de Obra)</span><input disabled={settingDisabled} type="number" step="1" min="1" max="720" value={settings.defaultStandardHours} onChange={(e) => setSettings({ ...settings, defaultStandardHours: Number(e.target.value) })} /></label>
                <label><span>Validade Padrão da Proposta (em dias)</span><input disabled={settingDisabled} type="number" step="1" min="1" max="365" value={settings.defaultValidityDays} onChange={(e) => setSettings({ ...settings, defaultValidityDays: Number(e.target.value) })} /></label>
              </div>
            </div>

            <div className="settings-card" style={{ background: '#f8fafc', border: '1px solid #e4e6ea', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Database size={19} color="#178442" />
                <div><h2 style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Ambiente e Armazenamento Local</h2><p style={{ margin: '2px 0 0', fontSize: '10px', color: '#697386' }}>Arquitetura Local-First Construtec Orçamentos.</p></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', fontSize: '11px' }}>
                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e4e6ea' }}><span style={{ color: '#697386', display: 'block', fontSize: '10px' }}>Versão do App</span><b style={{ color: '#172033', fontSize: '13px' }}>v1.0.5</b></div>
                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e4e6ea' }}><span style={{ color: '#697386', display: 'block', fontSize: '10px' }}>Banco Local</span><b style={{ color: '#178442', fontSize: '13px' }}>PGlite / PostgreSQL</b></div>
                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e4e6ea' }}><span style={{ color: '#697386', display: 'block', fontSize: '10px' }}>Modo de Operação</span><b style={{ color: '#085ce5', fontSize: '13px' }}>Offline Local-First</b></div>
              </div>
              {isAdmin && (
                <div style={{ display: 'grid', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #e4e6ea' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                      <b style={{ display: 'block', color: '#172033', fontSize: '11px' }}>Backup do banco local</b>
                      <span style={{ color: '#697386', fontSize: '9px' }}>Gera um tar.gz consistente pelo mecanismo oficial do PGlite. O arquivo pode ser guardado fora deste computador.</span>
                    </div>
                    <button type="button" onClick={() => void createBackup()} disabled={backupPending || restorePending} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 11px', background: '#fff', border: '1px solid #cfd5de', borderRadius: '6px', cursor: backupPending ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                      <Download size={14} /> {backupPending ? 'Gerando…' : 'Criar backup'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', paddingTop: '10px', borderTop: '1px solid #edf0f4' }}>
                    <div>
                      <b style={{ display: 'block', color: '#172033', fontSize: '11px' }}>Restaurar banco local</b>
                      <span style={{ color: '#697386', fontSize: '9px' }}>Valida o backup antes da troca, cria uma cópia de emergência do banco atual e reinicia o aplicativo.</span>
                    </div>
                    <button type="button" onClick={() => void restoreBackup()} disabled={backupPending || restorePending} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 11px', background: '#fff', border: '1px solid #cfd5de', borderRadius: '6px', cursor: restorePending ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                      <Upload size={14} /> {restorePending ? 'Validando…' : 'Restaurar backup'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>

          {isAdmin && (
            <section className="settings-card" style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #f0f2f5', paddingBottom: '12px' }}>
                <Users size={19} color="#085ce5" />
                <div><h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Usuários e Permissões</h2><p style={{ margin: '2px 0 0', fontSize: '10px', color: '#697386' }}>Contas locais deste computador. Usuários são desativados em vez de excluídos para preservar o histórico.</p></div>
              </div>

              <form onSubmit={(event) => void createUser(event)} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.25fr .9fr .85fr auto', gap: '8px', alignItems: 'end', padding: '12px', background: '#f8fafc', border: '1px solid #e4e6ea', borderRadius: '6px', marginBottom: '14px' }}>
                <label style={{ display: 'grid', gap: '5px', fontSize: '10px' }}><span>Nome</span><input required minLength={2} value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></label>
                <label style={{ display: 'grid', gap: '5px', fontSize: '10px' }}><span>E-mail</span><input required type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></label>
                <label style={{ display: 'grid', gap: '5px', fontSize: '10px' }}><span>Senha inicial</span><input required type="password" minLength={10} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></label>
                <label style={{ display: 'grid', gap: '5px', fontSize: '10px' }}><span>Perfil</span><select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as AuthRole })}><option value="commercial">Comercial</option><option value="viewer">Consulta</option><option value="admin">Administrador</option></select></label>
                <button type="submit" className="primary" disabled={userPending} style={{ height: '36px', border: '1px solid #085ce5', borderRadius: '6px', padding: '0 12px' }}><UserPlus size={15} /> Criar</button>
              </form>

              <div style={{ display: 'grid', gap: '10px' }}>
                {users.map((user) => (
                  <div key={user.id} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.25fr .82fr auto', gap: '8px 10px', padding: '12px', border: '1px solid #e4e6ea', borderRadius: '6px', background: user.active ? '#fff' : '#fafafa', opacity: user.active ? 1 : .72 }}>
                    <label style={{ display: 'grid', gap: '4px', fontSize: '9px', color: '#697386' }}><span>Nome {user.id === currentUser?.id ? '• Você' : ''}</span><input value={user.name} onChange={(e) => updateUserDraft(user.id, { name: e.target.value })} /></label>
                    <label style={{ display: 'grid', gap: '4px', fontSize: '9px', color: '#697386' }}><span>E-mail</span><input type="email" value={user.email} onChange={(e) => updateUserDraft(user.id, { email: e.target.value })} /></label>
                    <label style={{ display: 'grid', gap: '4px', fontSize: '9px', color: '#697386' }}><span>Perfil</span><select value={user.role} onChange={(e) => updateUserDraft(user.id, { role: e.target.value as AuthRole })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '7px' }}><label style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '36px', fontSize: '10px' }}><input type="checkbox" checked={user.active} onChange={(e) => updateUserDraft(user.id, { active: e.target.checked })} /> Ativo</label><button type="button" onClick={() => void saveUser(user)} disabled={userPending} style={{ height: '34px', padding: '0 10px', background: '#fff', border: '1px solid #cfd5de', borderRadius: '6px', cursor: 'pointer' }}><Save size={14} /> Salvar</button></div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px', borderTop: '1px solid #f0f2f5' }}>
                      <KeyRound size={14} color="#697386" /><span style={{ color: '#697386', fontSize: '9px' }}>Nova senha</span><input type="password" minLength={10} value={passwordDrafts[user.id] ?? ''} onChange={(e) => setPasswordDrafts((current) => ({ ...current, [user.id]: e.target.value }))} placeholder="Mínimo 10 caracteres" style={{ width: '220px', height: '30px' }} /><button type="button" onClick={() => void resetPassword(user)} disabled={userPending} style={{ height: '30px', padding: '0 9px', background: '#fff', border: '1px solid #cfd5de', borderRadius: '5px', cursor: 'pointer' }}>Redefinir senha</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
