import { BrowserWindow, session } from 'electron';

export const WEBMAIL_PARTITION = 'persist:construtec-webmail';
export const WEBMAIL_URL = 'https://webmailpro.uol.com.br/';

export type WebmailComposeData = {
  to?: string;
  subject?: string;
  body?: string;
};

let webmailWindow: BrowserWindow | undefined;

export const webmailSession = () => session.fromPartition(WEBMAIL_PARTITION);

export const webmailConnectionStatus = async (): Promise<{ connected: boolean }> => {
  try {
    const cookies = await webmailSession().cookies.get({ domain: 'uol.com.br' });
    const hasAuthCookie = cookies.some((c) =>
      /auth|token|session|mailpro|sessid/i.test(c.name)
    );
    return { connected: hasAuthCookie };
  } catch {
    return { connected: false };
  }
};

export const disconnectWebmail = async (): Promise<{ success: boolean }> => {
  try {
    await webmailSession().clearStorageData({ storages: ['cookies', 'localstorage'] });
    await webmailSession().clearCache();
    if (webmailWindow && !webmailWindow.isDestroyed()) {
      await webmailWindow.loadURL(WEBMAIL_URL);
    }
    return { success: true };
  } catch {
    return { success: false };
  }
};

function buildHelperInjectionScript(compose: WebmailComposeData): string {
  const safeTo = JSON.stringify(compose.to || '');
  const safeSubject = JSON.stringify(compose.subject || '');
  const safeBody = JSON.stringify(compose.body || '');

  return `
    (function() {
      if (document.getElementById('construtec-compose-helper')) return;
      const toVal = ${safeTo};
      const subVal = ${safeSubject};
      const bodyVal = ${safeBody};

      const bar = document.createElement('div');
      bar.id = 'construtec-compose-helper';
      bar.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; background: #163d69; color: #ffffff; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.35); padding: 12px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; display: flex; align-items: center; gap: 8px; border-left: 4px solid #12A9D1; max-width: 90vw;';

      bar.innerHTML = \`
        <strong style="color: #12A9D1; letter-spacing: 0.5px;">CONSTRUTEC</strong>
        <span style="opacity: 0.85; margin-right: 4px;">Proposta pronta:</span>
        \${toVal ? '<button id="ct-btn-to" style="background:#204b7c;color:#fff;border:1px solid #12A9D1;border-radius:4px;padding:5px 9px;cursor:pointer;font-size:11px;font-weight:600;">Copiar Destinatário</button>' : ''}
        \${subVal ? '<button id="ct-btn-sub" style="background:#204b7c;color:#fff;border:1px solid #12A9D1;border-radius:4px;padding:5px 9px;cursor:pointer;font-size:11px;font-weight:600;">Copiar Assunto</button>' : ''}
        <button id="ct-btn-body" style="background:#12A9D1;color:#fff;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-size:11px;font-weight:700;">Copiar Mensagem</button>
        <button id="ct-btn-close" title="Fechar painel" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:18px;margin-left:4px;line-height:1;">&times;</button>
      \`;

      document.body.appendChild(bar);

      function copyText(btn, text, label) {
        navigator.clipboard.writeText(text).then(() => {
          const orig = btn.innerText;
          btn.innerText = 'Copiado!';
          btn.style.background = '#10b981';
          setTimeout(() => {
            btn.innerText = orig;
            btn.style.background = label === 'body' ? '#12A9D1' : '#204b7c';
          }, 2000);
        });
      }

      const btnTo = document.getElementById('ct-btn-to');
      if (btnTo) btnTo.onclick = () => copyText(btnTo, toVal, 'to');

      const btnSub = document.getElementById('ct-btn-sub');
      if (btnSub) btnSub.onclick = () => copyText(btnSub, subVal, 'sub');

      const btnBody = document.getElementById('ct-btn-body');
      if (btnBody) btnBody.onclick = () => copyText(btnBody, bodyVal, 'body');

      const btnClose = document.getElementById('ct-btn-close');
      if (btnClose) btnClose.onclick = () => bar.remove();
    })();
  `;
}

export const openWebmailWindow = async (composeData?: WebmailComposeData): Promise<{ opened: boolean }> => {
  if (webmailWindow && !webmailWindow.isDestroyed()) {
    webmailWindow.focus();
    if (composeData?.body) {
      void webmailWindow.webContents.executeJavaScript(buildHelperInjectionScript(composeData));
    }
    return { opened: true };
  }

  webmailWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 920,
    minHeight: 660,
    title: 'Webmail Corporativo — Construtec (UOL Pro)',
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      partition: WEBMAIL_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  webmailWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (composeData?.body) {
    webmailWindow.webContents.on('did-finish-load', () => {
      void webmailWindow?.webContents.executeJavaScript(buildHelperInjectionScript(composeData)).catch(() => undefined);
    });
  }

  webmailWindow.on('closed', () => {
    webmailWindow = undefined;
  });

  await webmailWindow.loadURL(WEBMAIL_URL);
  webmailWindow.show();
  webmailWindow.focus();

  return { opened: true };
};
