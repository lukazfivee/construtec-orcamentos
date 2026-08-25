import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { dialog } from 'electron';
import type { CatalogImportFile } from '../shared/contracts';
import { xlsxToTsv } from './xlsx';

const execFileAsync = promisify(execFile);
const OCR_URL = process.env.CONSTRUTEC_OCR_URL?.trim();
const OCR_TOKEN = process.env.CONSTRUTEC_OCR_TOKEN?.trim();
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const mimeFromExtension = (extension: string) => {
  if (extension === '.png') return 'image/png';
  if (extension === '.bmp') return 'image/bmp';
  return 'image/jpeg';
};

const recognizeWithCloudflare = async (filePath: string) => {
  if (!OCR_URL) throw new Error('OCR_CLOUDFLARE_NOT_CONFIGURED');
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
  const script = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Storage.FileAccessMode,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine,Windows.Media.Ocr,ContentType=WindowsRuntime]
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod })[0]
function Await($operation, $resultType) {
  $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait()
  return $task.Result
}
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($env:CONSTRUTEC_OCR_PATH)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) { throw 'Instale o pacote de idioma Português nas configurações do Windows.' }
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

# O Windows OCR pode devolver uma tabela por coluna. Para preservar cada produto,
# reconstruímos as linhas usando a posição visual (X/Y) de cada palavra.
$words = New-Object System.Collections.Generic.List[object]
foreach ($line in $result.Lines) {
  foreach ($word in $line.Words) {
    $rect = $word.BoundingRect
    $words.Add([PSCustomObject]@{
      Text = [string]$word.Text
      X = [double]$rect.X
      Y = [double]$rect.Y
      W = [double]$rect.Width
      H = [double]$rect.Height
      CY = [double]($rect.Y + ($rect.Height / 2.0))
    })
  }
}

if ($words.Count -eq 0) {
  $result.Lines | ForEach-Object { $_.Text }
  exit 0
}

$avgHeight = ($words | Measure-Object -Property H -Average).Average
if (-not $avgHeight -or $avgHeight -lt 4) { $avgHeight = 14 }
$tolerance = [Math]::Max(5, $avgHeight * 0.72)
$visualRows = New-Object System.Collections.Generic.List[object]

foreach ($word in ($words | Sort-Object CY, X)) {
  $best = $null
  $bestDistance = [double]::MaxValue
  foreach ($row in $visualRows) {
    $distance = [Math]::Abs([double]$row.CY - [double]$word.CY)
    if ($distance -le $tolerance -and $distance -lt $bestDistance) {
      $best = $row
      $bestDistance = $distance
    }
  }
  if ($null -eq $best) {
    $list = New-Object System.Collections.Generic.List[object]
    $list.Add($word)
    $visualRows.Add([PSCustomObject]@{ CY = [double]$word.CY; Words = $list })
  } else {
    $best.Words.Add($word)
    $best.CY = (($best.CY * ($best.Words.Count - 1)) + $word.CY) / $best.Words.Count
  }
}

foreach ($row in ($visualRows | Sort-Object CY)) {
  $ordered = @($row.Words | Sort-Object X)
  $parts = New-Object System.Collections.Generic.List[string]
  $previous = $null
  foreach ($word in $ordered) {
    if ($null -ne $previous) {
      $gap = [double]$word.X - ([double]$previous.X + [double]$previous.W)
      if ($gap -gt [Math]::Max(22, $avgHeight * 1.8)) { $parts.Add('   ') }
    }
    $parts.Add([string]$word.Text)
    $previous = $word
  }
  (($parts -join ' ') -replace '\s{4,}', '   ').Trim()
}
`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    env: { ...process.env, CONSTRUTEC_OCR_PATH: filePath },
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
  return result.stdout.trim();
};

const recognizeImage = async (filePath: string): Promise<{ text: string; engine: 'cloudflare' | 'windows' }> => {
  if (OCR_URL) {
    try {
      return { text: await recognizeWithCloudflare(filePath), engine: 'cloudflare' };
    } catch (error) {
      console.warn('OCR Cloudflare indisponível; usando OCR local.', error);
    }
  }
  return { text: await recognizeWithWindows(filePath), engine: 'windows' };
};

export const selectCatalogImport = async (kind: 'table' | 'image'): Promise<CatalogImportFile> => {
  const selection = await dialog.showOpenDialog({
    title: 'Importar itens para o catálogo',
    properties: ['openFile'],
    filters: [
      kind === 'image'
        ? { name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }
        : { name: 'Planilhas', extensions: ['xlsx', 'csv', 'tsv', 'txt'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });
  const filePath = selection.filePaths[0];
  if (selection.canceled || !filePath) return { canceled: true };
  const extension = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);
  if (['.png', '.jpg', '.jpeg', '.bmp'].includes(extension)) {
    const result = await recognizeImage(filePath);
    return { canceled: false, kind: 'image', name, text: result.text, ocrEngine: result.engine };
  }
  const buffer = await readFile(filePath);
  const text = extension === '.xlsx' ? await xlsxToTsv(buffer) : buffer.toString('utf8').replace(/^\uFEFF/, '');
  return { canceled: false, kind: 'table', name, text };
};
