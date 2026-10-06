import { useEffect, useState, type FormEvent } from 'react';
import { MailCheck, Save, Trash2, UserPlus, Users } from 'lucide-react';
import type { AuthRole, AuthUser, AuthorizedEmailRecord, UserRecord } from '../shared/contracts';
import { usersApi } from './api';
import { SettingsCard } from './SettingsSections';

// Contas sao do Centro de Custos (identidade compartilhada). Aqui o admin do
// Orcamentos cria, desativa e exclui logins pelo diretorio central e escolhe o
// papel da conta dentro do Orcamentos. Nome, e-mail e senha sao da conta.

type NewUserDraft = { name: string; email: string; password: string; role: AuthRole };

const emptyUser: NewUserDraft = { name: '', email: '', password: '', role: 'commercial' };
const roleLabels: Record<AuthRole, string> = { admin: 'Administrador', commercial: 'Comercial', viewer: 'Consulta' };

type Props = {
  currentUser: AuthUser;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

export function UsersAdminPanel({ currentUser, onNotice, onError }: Props) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [emails, setEmails] = useState<AuthorizedEmailRecord[]>([]);
  const [newUser, setNewUser] = useState<NewUserDraft>(emptyUser);
  const [newEmail, setNewEmail] = useState({ email: '', note: '' });
  const [pending, setPending] = useState(false);

  const fail = (error: unknown, fallback: string) => onError(error instanceof Error ? error.message : fallback);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [usersResult, emailsResult] = await Promise.all([usersApi.list(), usersApi.authorizedEmails()]);
        if (!active) return;
        setUsers(usersResult.users);
        setEmails(emailsResult.emails);
      } catch (error) {
        if (active) fail(error, 'Não foi possível carregar os usuários.');
      }
    })();
    return () => { active = false; };
  }, []);

  const run = async (action: () => Promise<void>, fallback: string) => {
    if (pending) return;
    setPending(true);
    try { await action(); } catch (error) { fail(error, fallback); } finally { setPending(false); }
  };

  const createUser = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await usersApi.create(newUser);
      setUsers(result.users);
      setNewUser(emptyUser);
      onNotice('Conta criada. A mesma conta vale no Centro de Custos.');
    }, 'Não foi possível criar a conta.');
  };

  const updateDraft = (userId: string, changes: Partial<UserRecord>) => {
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, ...changes } : user));
  };

  const saveUser = (user: UserRecord) => void run(async () => {
    try {
      const result = await usersApi.update(user.id, { role: user.role, active: user.active });
      setUsers(result.users);
      onNotice('Usuário atualizado.');
    } catch (error) {
      setUsers((await usersApi.list().catch(() => ({ users }))).users);
      throw error;
    }
  }, 'Não foi possível atualizar o usuário.');

  const removeUser = (user: UserRecord) => {
    const confirmed = window.confirm(`Excluir o login de ${user.name}? A pessoa perde o acesso ao Orçamentos e ao Centro de Custos, e o e-mail fica livre para uma conta nova. O histórico não é apagado. Não é possível desfazer.`);
    if (!confirmed) return;
    void run(async () => {
      setUsers((await usersApi.remove(user.id)).users);
      onNotice('Login excluído.');
    }, 'Não foi possível excluir o login.');
  };

  const authorizeEmail = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      setEmails((await usersApi.authorizeEmail(newEmail.email.trim(), newEmail.note.trim())).emails);
      setNewEmail({ email: '', note: '' });
      onNotice('E-mail externo autorizado.');
    }, 'Não foi possível autorizar o e-mail.');
  };

  const revokeEmail = (email: string) => {
    if (!window.confirm(`Revogar a autorização de ${email}? Uma conta já criada continua ativa; para remover o acesso, use Excluir login.`)) return;
    void run(async () => {
      setEmails((await usersApi.revokeEmail(email)).emails);
      onNotice('Autorização revogada.');
    }, 'Não foi possível revogar a autorização.');
  };

  return (
    <SettingsCard icon={Users} title="Usuários e Permissões" sub="As contas são as mesmas do Centro de Custos. O perfil abaixo vale só no Orçamentos; a senha é trocada pela própria pessoa no Centro de Custos.">
      <form onSubmit={createUser} className="st-new-user">
        <label className="od-fld"><span>Nome</span><input className="od-inp" required minLength={2} value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></label>
        <label className="od-fld"><span>E-mail</span><input className="od-inp" required type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></label>
        <label className="od-fld"><span>Senha inicial</span><input className="od-inp" required type="password" minLength={10} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></label>
        <label className="od-fld"><span>Perfil no Orçamentos</span><select className="od-inp" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as AuthRole })}><option value="commercial">Comercial</option><option value="viewer">Consulta</option><option value="admin">Administrador</option></select></label>
        <button type="submit" className="od-btn p" disabled={pending}><UserPlus size={17} strokeWidth={1.5} /> Criar</button>
      </form>

      <div className="st-users">
        {users.map((user) => (
          <div key={user.id} className={`st-user${user.active ? '' : ' off'}`}>
            <div className="st-cell"><span>Nome {user.id === currentUser.id ? '· Você' : ''}</span><strong>{user.name}</strong></div>
            <div className="st-cell"><span>E-mail</span><strong>{user.email}</strong></div>
            <label className="od-fld" title={user.centroAdmin ? 'Administrador no Centro de Custos: o perfil muda lá.' : undefined}><span>Perfil{user.centroAdmin ? ' · pelo Centro' : ''}</span><select className="od-inp" disabled={user.centroAdmin} value={user.role} onChange={(e) => updateDraft(user.id, { role: e.target.value as AuthRole })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div className="st-user-actions">
              <label className="st-check"><input type="checkbox" checked={user.active} onChange={(e) => updateDraft(user.id, { active: e.target.checked })} /> Ativo</label>
              <button type="button" className="od-btn s sm" onClick={() => saveUser(user)} disabled={pending}><Save size={15} strokeWidth={1.5} /> Salvar</button>
              {user.id !== currentUser.id && <button type="button" className="od-btn s sm danger" onClick={() => removeUser(user)} disabled={pending} aria-label={`Excluir login de ${user.name}`}><Trash2 size={15} strokeWidth={1.5} /> Excluir login</button>}
            </div>
          </div>
        ))}
      </div>

      <div className="st-sub">
        <div className="st-subhead">
          <MailCheck size={18} strokeWidth={1.5} />
          <div><h3>E-mails externos autorizados</h3><p>Contas fora do domínio @rcconstrutec.com.br só podem ser criadas para e-mails desta lista.</p></div>
        </div>
        <form onSubmit={authorizeEmail} className="st-auth">
          <label className="od-fld"><span>E-mail</span><input className="od-inp" required type="email" maxLength={254} value={newEmail.email} onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })} /></label>
          <label className="od-fld"><span>Observação</span><input className="od-inp" maxLength={200} value={newEmail.note} placeholder="Ex.: vendedor terceirizado" onChange={(e) => setNewEmail({ ...newEmail, note: e.target.value })} /></label>
          <button type="submit" className="od-btn s" disabled={pending}>Autorizar</button>
        </form>
        {emails.length === 0
          ? <p className="st-empty">Nenhum e-mail externo autorizado.</p>
          : emails.map((row) => (
            <div key={row.email} className="st-mail">
              <span><strong>{row.email}</strong>{row.note ? <span className="muted"> · {row.note}</span> : null}</span>
              <button type="button" className="od-btn s sm" onClick={() => revokeEmail(row.email)} disabled={pending}>Revogar</button>
            </div>
          ))}
      </div>
    </SettingsCard>
  );
}
