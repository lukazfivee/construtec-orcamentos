// Microfone do assistente (ditado por voz): o Electron so entrega o audio se a pagina pedir e o processo principal deixar.
// Libera "media" so para audio e so para a propria pagina do app (arquivo local ou 127.0.0.1); camera e qualquer outro
// site continuam negados. Os demais tipos de permissao seguem como o Electron trata por padrao (permitidos), para nao mudar
// o que ja funcionava (area de transferencia, por exemplo).

type MediaDetails = { mediaTypes?: Array<'video' | 'audio'>; mediaType?: 'video' | 'audio' | 'unknown'; requestingUrl?: string; securityOrigin?: string };
export type PermissionSession = {
  setPermissionRequestHandler(handler: ((contents: unknown, permission: string, callback: (granted: boolean) => void, details: MediaDetails) => void) | null): void;
  setPermissionCheckHandler(handler: ((contents: unknown, permission: string, origin: string, details: MediaDetails) => boolean) | null): void;
};

/** Paginas do proprio app: arquivo local, protocolo da Suite ou o servidor local do Orcamentos. */
export const isOwnPage = (url: string | undefined): boolean => Boolean(url) && /^(file:|suite:|app:|https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$))/i.test(url as string);

export function installMicrophonePermission(ses: PermissionSession): void {
  ses.setPermissionRequestHandler((_contents, permission, callback, details) => {
    if (permission !== 'media') { callback(true); return; }
    const types = details.mediaTypes ?? [];
    callback(types.length > 0 && types.every((type) => type === 'audio') && isOwnPage(details.requestingUrl));
  });
  ses.setPermissionCheckHandler((_contents, permission, origin, details) => {
    if (permission !== 'media') return true;
    return details.mediaType === 'audio' && isOwnPage(details.requestingUrl || origin);
  });
}
