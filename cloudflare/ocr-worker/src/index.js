const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
});

const authorized = (request, env) => {
  if (!env.OCR_SHARED_TOKEN) return false;
  return request.headers.get('authorization') === `Bearer ${env.OCR_SHARED_TOKEN}`;
};

const base64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const responseText = (result) => {
  if (typeof result?.response === 'string') return result.response.trim();
  const content = result?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
};

const recognizeWithVision = async (file, env) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const imageUrl = `data:${file.type};base64,${base64(bytes)}`;
  const result = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
    messages: [
      {
        role: 'system',
        content: 'Você é um mecanismo de OCR para documentos comerciais brasileiros. Transcreva o conteúdo visível com precisão. Não resuma, não explique, não corrija códigos e não invente dados.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Transcreva esta imagem. Preserve a ordem visual das linhas. Em tabelas, mantenha cada produto em uma linha e separe colunas por TAB. Preserve exatamente códigos, descrições, quantidades, R$, separadores decimais, percentuais e preços. Inclua cabeçalhos úteis. Retorne somente a transcrição.',
          },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0,
    max_completion_tokens: 6000,
    chat_template_kwargs: { thinking: false },
  });
  const text = responseText(result);
  if (!text) throw new Error('VISION_EMPTY');
  return text;
};

const recognizeWithMarkdown = async (file, env) => {
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
  if (!result || result.format === 'error') throw new Error(result?.error || 'MARKDOWN_FAILED');
  const text = typeof result.data === 'string' ? result.data.trim() : '';
  if (!text) throw new Error('MARKDOWN_EMPTY');
  return text;
};

export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return json({
        ok: true,
        service: 'construtec-catalog-ocr',
        model: '@cf/google/gemma-4-26b-a4b-it',
        authentication: env.OCR_SHARED_TOKEN ? 'required' : 'not_configured',
      });
    }
    if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    if (!authorized(request, env)) return json({ error: 'UNAUTHORIZED' }, 401);

    try {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return json({ error: 'FILE_REQUIRED' }, 400);
      if (!file.type.startsWith('image/')) return json({ error: 'IMAGE_REQUIRED' }, 415);
      if (file.size > 10 * 1024 * 1024) return json({ error: 'IMAGE_TOO_LARGE' }, 413);

      try {
        const text = await recognizeWithVision(file, env);
        return json({ text, engine: 'cloudflare-gemma-vision', format: 'text' });
      } catch (visionError) {
        console.warn('Gemma Vision OCR falhou; usando conversão de imagem.', visionError);
        const text = await recognizeWithMarkdown(file, env);
        return json({ text, engine: 'cloudflare-tomarkdown', format: 'text' });
      }
    } catch (error) {
      return json({ error: 'OCR_FAILED', details: error instanceof Error ? error.message : String(error) }, 500);
    }
  },
};
