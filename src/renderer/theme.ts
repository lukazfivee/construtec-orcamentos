// Tema do desktop: claro, escuro ou automático (segue o sistema). A escolha fica em localStorage e é aplicada em
// <html data-theme> antes da primeira pintura pelo script de index.html (mesma regra de resolveTheme).
import { useEffect, useState } from 'react';

export type ThemeMode = 'auto' | 'claro' | 'escuro';
export type ResolvedTheme = 'claro' | 'escuro';

export const THEME_STORAGE_KEY = 'orc_d_tema';
// Cor da barra do navegador: a barra superior do app é navy nos dois temas.
export const THEME_COLORS: Record<ResolvedTheme, string> = { claro: '#031f29', escuro: '#021820' };

export function parseThemeMode(value: unknown): ThemeMode {
  return value === 'claro' || value === 'escuro' ? value : 'auto';
}

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'claro' || mode === 'escuro') return mode;
  return systemPrefersDark ? 'escuro' : 'claro';
}

export function readThemeMode(): ThemeMode {
  try { return parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY)); } catch { return 'auto'; }
}

const systemPrefersDark = () => {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
};

export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode, systemPrefersDark());
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themeMode = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', resolved === 'escuro' ? 'dark' : 'light');
  return resolved;
}

export function setThemeMode(mode: ThemeMode): ResolvedTheme {
  try {
    if (mode === 'auto') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch { /* sem armazenamento: vale só nesta sessão */ }
  const resolved = applyTheme(mode);
  window.dispatchEvent(new CustomEvent('orc-theme-change', { detail: { mode, resolved } }));
  return resolved;
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => readThemeMode());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readThemeMode(), systemPrefersDark()));
  useEffect(() => {
    const sync = () => { const next = readThemeMode(); setMode(next); setResolved(resolveTheme(next, systemPrefersDark())); };
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => { if (readThemeMode() === 'auto') { applyTheme('auto'); sync(); } };
    window.addEventListener('orc-theme-change', sync);
    window.addEventListener('storage', sync);
    query.addEventListener('change', onSystem);
    return () => { window.removeEventListener('orc-theme-change', sync); window.removeEventListener('storage', sync); query.removeEventListener('change', onSystem); };
  }, []);
  return { mode, resolved, setMode: setThemeMode, toggle: () => setThemeMode(resolved === 'escuro' ? 'claro' : 'escuro') };
}
