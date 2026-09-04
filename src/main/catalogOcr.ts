import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { windowsOcrPowerShellScript } from './catalogOcrScript';

const execFileAsync = promisify(execFile);
const OCR_URL = process.env.CONSTRUTEC_OCR_URL?.trim();
const OCR_TOKEN = process.env.CONSTRUTEC_OCR_TOKEN?.trim();
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const STRUCTURED_MARKER = '@CATALOG@';

export const runPowerShellScript = async (script: string, env: NodeJS.ProcessEnv, timeout: number) => {
  const scriptDir = await mkdtemp(path.join(tmpdir(), 'construtec-ps-'));
  const scriptPath = path.join(scriptDir, 'script.ps1');
  try {
    await writeFile(scriptPath, `\uFEFF${script}`, 'utf8');
    return await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      env,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout,
    });
  } finally {
    await rm(scriptDir, { recursive: true, force: true });
  }
};

const mimeFromExtension = (extension: string) => {
  if (extension === '.png') return 'image/png';
  if (extension === '.bmp') return 'image/bmp';
  return 'image/jpeg';
};

const recognizeWithCloudflare = async (filePath: string) => {
  if (!OCR_URL) throw new Error('OCR_CLOUDFLARE_NOT_CONFIGURED');
  if (!OCR_TOKEN) throw new Error('OCR_CLOUDFLARE_TOKEN_REQUIRED');
  const buffer = await readFile(filePath);
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('OCR_IMAGE_TOO_LARGE');
  const extension = path.extname(filePath).toLowerCase();
  const form = new FormData();
  const bytes = new Uint8Array(buffer);
  form.append('file', new Blob([bytes], { type: mimeFromExtension(extension) }), path.basename(filePath));
  const headers: Record<string, string> = {};
  if (OCR_TOKEN) headers.Authorization = `Bearer ${OCR_TOKEN}`;
  const response = await fetch(OCR_URL, {
    method: 'POST',
    headers,
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`OCR_CLOUDFLARE_${response.status}`);
  const payload = await response.json() as { text?: unknown };
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (text.length < 3) throw new Error('OCR_CLOUDFLARE_EMPTY');
  return text;
};

const recognizeWithWindows = async (filePath: string) => {
  if (process.platform !== 'win32') throw new Error('A leitura de imagem está disponível no instalador para Windows 10 ou superior.');
  const result = await runPowerShellScript(windowsOcrPowerShellScript, { ...process.env, CONSTRUTEC_OCR_PATH: filePath }, 120_000);
  return result.stdout.trim();
};

const renderPdfPagesWithWindows = async (filePath: string) => {
  if (process.platform !== 'win32') throw new Error('A leitura de PDF está disponível no instalador para Windows 10 ou superior.');
  const outputDir = await mkdtemp(path.join(tmpdir(), 'construtec-pdf-'));
  const script = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFolder,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Storage.FileAccessMode,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Storage.CreationCollisionOption,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Storage.FileAccessMode,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod })[0]
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and -not $_.IsGenericMethod })[0]
function Await($operation, $resultType) { $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($operation)); $task.Wait(); return $task.Result }
function Await-Action($operation) { $task = $asTaskAction.Invoke($null, @($operation)); $task.Wait() }
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($env:CONSTRUTEC_PDF_PATH)) ([Windows.Storage.StorageFile])
$pdf = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($env:CONSTRUTEC_PDF_OUT)) ([Windows.Storage.StorageFolder])
for ($i = 0; $i -lt $pdf.PageCount; $i += 1) {
  $page = $pdf.GetPage($i)
  try {
    $name = ('page-{0:D4}.png' -f ($i + 1))
    $out = Await ($folder.CreateFileAsync($name, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
    $stream = Await ($out.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])
    try { Await-Action ($page.RenderToStreamAsync($stream)) } finally { $stream.Dispose() }
  } finally { $page.Dispose() }
}
`;
  try {
    await runPowerShellScript(script, { ...process.env, CONSTRUTEC_PDF_PATH: filePath, CONSTRUTEC_PDF_OUT: outputDir }, 180_000);
    const pages = (await readdir(outputDir)).filter((name) => /^page-\d+\.png$/i.test(name)).sort().map((name) => path.join(outputDir, name));
    if (pages.length === 0) throw new Error('PDF_SEM_PAGINAS');
    return { outputDir, pages };
  } catch (error) { await rm(outputDir, { recursive: true, force: true }); throw error; }
};

export const recognizeImage = async (filePath: string): Promise<{ text: string; engine: 'cloudflare' | 'windows' }> => {
  if (OCR_URL) {
    try { return { text: await recognizeWithCloudflare(filePath), engine: 'cloudflare' }; }
    catch (error) { console.warn('OCR Cloudflare indisponível; usando OCR local.', error); }
  }
  return { text: await recognizeWithWindows(filePath), engine: 'windows' };
};

export const recognizePdf = async (filePath: string): Promise<{ text: string; engine: 'cloudflare' | 'windows' }> => {
  const rendered = await renderPdfPagesWithWindows(filePath);
  const texts: string[] = [];
  let engine: 'cloudflare' | 'windows' = OCR_URL ? 'cloudflare' : 'windows';
  try {
    for (const pagePath of rendered.pages) {
      const result = await recognizeImage(pagePath); texts.push(result.text); engine = result.engine;
    }
  } finally { await rm(rendered.outputDir, { recursive: true, force: true }); }
  const text = texts.filter(Boolean).join('\n');
  if (text.trim().length < 3) throw new Error('Nenhum texto foi reconhecido no PDF.');
  return { text, engine };
};
