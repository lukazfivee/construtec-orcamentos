import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, Building2, FileText, Headset, Mail } from 'lucide-react';
import { CENTRO_CUSTOS_CLOUD_URL, getCentroCustosUrl } from './api';
import type { SuiteAppId, SuiteMenuEntry } from './suiteMenu';
import { SUITE_APPS, SUITE_MENU_TITLE, SUITE_WEBMAIL } from './suiteMenu';

export { CHAMADOPRO_URL } from './suiteMenu';

interface SuiteSwitcherPopoverProps {
  activeApp?: 'orcamentos' | 'centro-custos';
  onSelectApp?: (app: 'orcamentos' | 'centro-custos') => void;
  onClose: () => void;
}

// Icones Lucide equivalentes aos Phosphor do Centro (file-text, chart-bar, wrench, envelope-simple), traço 1.5.
const ICONS: Record<SuiteAppId, LucideIcon> = {
  orcamentos: FileText,
  'centro-custos': Building2,
  chamadopro: Headset,
  webmail: Mail,
};

/* Menu Suite identico ao do Centro de Custos: mesmos destinos, textos e marcador "Atual". */
export function SuiteSwitcherPopover({ activeApp = 'orcamentos', onSelectApp, onClose }: SuiteSwitcherPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [centroUrl, setCentroUrl] = useState(CENTRO_CUSTOS_CLOUD_URL);

  useEffect(() => {
    void getCentroCustosUrl().then(setCentroUrl);
  }, []);

  useEffect(() => {
    (popoverRef.current?.querySelector<HTMLElement>('button.res') ?? null)?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        document.getElementById('btn-suite-switcher')?.focus();
      }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && popoverRef.current) {
        const items = Array.from(popoverRef.current.querySelectorAll<HTMLElement>('button.res'));
        if (!items.length) return;
        event.preventDefault();
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);
        items[next].focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      const toggleBtn = document.getElementById('btn-suite-switcher');
      if (toggleBtn && (toggleBtn === event.target || toggleBtn.contains(event.target as Node))) return;
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  const handleOpenUrl = (url: string) => {
    try {
      if (window.construtec?.openExternal) void window.construtec.openExternal(url);
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  const activate = (entry: SuiteMenuEntry) => {
    if (entry.id === 'webmail' && window.construtec?.openWebmail) {
      void window.construtec.openWebmail();
      onClose();
    } else if (entry.id === 'centro-custos') {
      handleOpenUrl(centroUrl);
    } else if (entry.id === 'orcamentos') {
      onSelectApp?.('orcamentos');
      onClose();
    } else if (entry.url) {
      handleOpenUrl(entry.url);
    }
  };

  const renderEntry = (entry: SuiteMenuEntry) => {
    const Icon = ICONS[entry.id];
    const body = (
      <>
        <span className="ic"><Icon size={17} strokeWidth={1.5} /></span>
        <span className="tx"><b>{entry.title}</b><span>{entry.subtitle}</span></span>
      </>
    );
    if (entry.id === activeApp) {
      return (
        <div key={entry.id} className="res atual" role="menuitem" aria-current="page">
          {body}<span className="chip ok">Atual</span>
        </div>
      );
    }
    return (
      <button key={entry.id} type="button" className="res" role="menuitem" onClick={() => activate(entry)}>
        {body}<ArrowUpRight size={15} strokeWidth={1.5} />
      </button>
    );
  };

  return (
    <div className="pop" ref={popoverRef} role="menu" aria-label={SUITE_MENU_TITLE}>
      <span className="lbl">{SUITE_MENU_TITLE}</span>
      {SUITE_APPS.map(renderEntry)}
      <div className="sep" role="separator" />
      {renderEntry(SUITE_WEBMAIL)}
    </div>
  );
}
