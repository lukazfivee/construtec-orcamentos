import { useEffect, useRef } from 'react';
import { LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import type { AuthUser } from '../shared/contracts';

interface UserProfilePopoverProps {
  user: AuthUser;
  onLogout: () => void;
  onClose: () => void;
}

const roleLabels: Record<AuthUser['role'], string> = {
  admin: 'Administrador',
  commercial: 'Comercial',
  viewer: 'Consulta',
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CT';

export function UserProfilePopover({ user, onLogout, onClose }: UserProfilePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(user.name);
  const roleLabel = roleLabels[user.role] ?? user.role;
  const isRemembered = localStorage.getItem('construtec.auth.remember_me') === 'true';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  return (
    <div className="user-profile-popover" ref={popoverRef} role="dialog" aria-label="Perfil do usuário">
      <div className="user-profile-header">
        <div className="user-profile-avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="user-profile-info">
          <strong className="user-profile-name">{user.name}</strong>
          <span className="user-profile-email">{user.email}</span>
          <span className={`user-profile-role-badge role-${user.role}`}>
            <UserCheck size={12} /> {roleLabel}
          </span>
        </div>
      </div>

      <div className="user-profile-details">
        <div className="user-profile-detail-row">
          <ShieldCheck size={14} className="detail-icon" />
          <div>
            <span className="detail-title">Armazenamento Local</span>
            <small className="detail-subtitle">Dados protegidos no PGlite deste computador</small>
          </div>
        </div>
        <div className="user-profile-detail-row">
          <span className="session-status-dot" aria-hidden="true" />
          <div>
            <span className="detail-title">Tipo de Sessão</span>
            <small className="detail-subtitle">
              {isRemembered ? 'Lembrar de Mim ativo (30 dias)' : 'Sessão temporária (8 horas)'}
            </small>
          </div>
        </div>
      </div>

      <div className="user-profile-actions">
        <button
          type="button"
          className="user-profile-logout-btn"
          onClick={() => {
            onClose();
            onLogout();
          }}
        >
          <LogOut size={15} /> Sair da conta
        </button>
      </div>
    </div>
  );
}
