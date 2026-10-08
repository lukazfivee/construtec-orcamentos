/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthGate } from './renderer/AuthGate';
import '@fontsource-variable/ibm-plex-sans';
import './theme-tokens.css';
import './suite-fonts.css';
import './index.css';
import './impeccable-audit.css';
import './auth.css';
import './suite-bolder.css';
import './kit-itens.css';
import './desktop-polish.css';
import './mobile-responsive.css';
import './mobile-suite.css';
import './proposal-pages.css';
import './theme-dark.css';
import './shell-centro.css';
import './paginas-centro.css';
import './telas-centro.css';
import './editor-centro.css';
import './config-centro.css';
import './editor-itens-centro.css';
import './editor-paineis-centro.css';
import './editor-layout-centro.css';
import './telas-internas-centro.css';
import './dialogos-centro.css';
import './updater.css';
import './escala-75.css';
import './transicao-telas.css';
import './titlebar.css';
import { WindowTitleBar } from './renderer/WindowTitleBar';

const rootElement = document.getElementById('root');

if (!rootElement) throw new Error('Elemento raiz do renderer não encontrado.');

// App do Windows: barra de titulo propria acima de tudo (inclusive do login), fora do #root.
if (window.construtec?.titleBar) {
  document.documentElement.classList.add('com-barra');
  const barRoot = document.createElement('div');
  barRoot.style.display = 'contents';
  rootElement.before(barRoot);
  createRoot(barRoot).render(<WindowTitleBar />);
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !window.construtec) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
