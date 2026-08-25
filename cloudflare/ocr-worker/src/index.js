const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
});

const authorized = (request, env) => {
  if (!env.OCR_SHARED_TOKEN) return true;
  return request.headers.get('authorization') === `Bearer ${env.OCR_SHARED_TOKEN}`;
};

export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return json({ ok: true, service: 'construtec-catalog-ocr' });
    }
    if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    if (!authorized(request, env)) return json({ error: 'UNAUTHORIZED' }, 401);

    try {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return json({ error: 'FILE_REQUIRED' }, 400);
      if (!file.type.startsWith('image/')) return json({ error: 'IMAGE_REQUIRED' }, 415);
      if (file.size > 10 * 1024 * 1024) return json({ error: 'IMAGE_TOO_LARGE' }, 413);

      const converted = await env.AI.toMarkdown(
        { name: file.name || 'catalog-image.png', blob: file },
        {
          conversionOptions: {
            image: { descriptionLanguage: 'pt' },
            output: { format: 'text' },
          },
        },
      );

      const result = Array.isArray(converted) ? converted[0] : converted;
      if (!result || result.format === 'error') {
        return json({ error: 'OCR_FAILED', details: result?.error || 'Conversão sem resultado.' }, 502);
      }
      const text = typeof result.data === 'string' ? result.data.trim() : '';
      if (!text) return json({ error: 'OCR_EMPTY' }, 422);

      return json({
        text,
        engine: 'cloudflare-workers-ai',
        format: result.format,
      });
    } catch (error) {
      return json({ error: 'OCR_FAILED', details: error instanceof Error ? error.message : String(error) }, 500);
    }
  },
};
