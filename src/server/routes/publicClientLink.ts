import { Router, type Request, type Response } from 'express';
import type { LocalDatabase } from '../services/database';
import { adjustPublicLink, approvePublicLink, openPublicLink, publicDocumentHtml, type PublicContext } from '../services/clientLinksPublic';
import { sendClientLinkError } from './proposalClientLink';

// Pagina publica do cliente (sem login). Tudo aqui e aberto na internet: limite por IP, token assinado e so preco de venda.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Janela fixa por IP e por tipo de uso (leitura x resposta); simples e suficiente para um Container so.
const limited = (key: string, max: number, windowMs: number) => {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
};

// Atras do Cloudflare so cf-connecting-ip e confiavel. Sem ele (acesso direto ou cabecalho forjado) todos caem num
// bucket unico e conservador; X-Forwarded-For nunca e usado, pois o cliente controla o primeiro item.
export const clientIp = (request: Request) => {
  const cf = request.headers['cf-connecting-ip'];
  return typeof cf === 'string' && cf.trim() ? cf.split(',')[0].trim() : 'sem-ip-confiavel';
};

// O token vai no cabecalho X-Link-Token (o caminho da URL aparece nos logs do Cloudflare). As rotas antigas com
// :token no caminho continuam para paginas ja abertas com o c.js antigo.
const tokenOf = (request: Request) => {
  const header = request.headers['x-link-token'];
  return typeof header === 'string' ? header : String(request.params.token ?? '');
};

export const DOCUMENT_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

export const createPublicClientLinkRouter = (database: LocalDatabase, secret: string) => {
  const router = Router();
  const context = (request: Request): PublicContext => ({ secret, ip: clientIp(request), userAgent: String(request.headers['user-agent'] || '') });
  const tooMany = (request: Request, response: Response, kind: 'read' | 'write') => {
    const blocked = kind === 'read' ? limited(`r:${clientIp(request)}`, 120, 60_000) : limited(`w:${clientIp(request)}`, 12, 10 * 60_000);
    if (blocked) response.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.', code: 'RATE_LIMITED' });
    return blocked;
  };
  router.use((_request, response, next) => { response.setHeader('X-Content-Type-Options', 'nosniff'); next(); });

  const open = async (request: Request, response: Response, next: (error: unknown) => void) => {
    try {
      if (tooMany(request, response, 'read')) return;
      response.setHeader('Cache-Control', 'no-store');
      response.json(await openPublicLink(database, tokenOf(request), context(request)));
    } catch (error) { sendClientLinkError(error, response, next); }
  };
  const document = async (request: Request, response: Response, next: (error: unknown) => void) => {
    try {
      if (tooMany(request, response, 'read')) return;
      const html = await publicDocumentHtml(database, tokenOf(request), secret);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Security-Policy', DOCUMENT_CSP);
      response.type('html').send(html);
    } catch (error) { sendClientLinkError(error, response, next); }
  };
  const approve = async (request: Request, response: Response, next: (error: unknown) => void) => {
    try {
      if (tooMany(request, response, 'write')) return;
      response.status(201).json(await approvePublicLink(database, tokenOf(request), request.body, context(request)));
    } catch (error) { sendClientLinkError(error, response, next); }
  };
  const adjust = async (request: Request, response: Response, next: (error: unknown) => void) => {
    try {
      if (tooMany(request, response, 'write')) return;
      await adjustPublicLink(database, tokenOf(request), request.body, context(request));
      response.status(201).json({ ok: true });
    } catch (error) { sendClientLinkError(error, response, next); }
  };

  router.get('/', open);
  router.get('/document', document);
  router.post('/approve', approve);
  router.post('/adjust', adjust);
  // Rotas antigas (token no caminho).
  router.get('/:token', open);
  router.get('/:token/document', document);
  router.post('/:token/approve', approve);
  router.post('/:token/adjust', adjust);

  return router;
};
