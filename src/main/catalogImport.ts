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
function Join-Words($items) {
  return ((@($items | Sort-Object X | ForEach-Object { [string]$_.Text }) -join ' ') -replace '\s+', ' ').Trim()
}
function Resolve-NetValue($netValue, $unitValue, $discountValue) {
  $net = (($netValue -replace '\s+', '')).Trim()
  if ($net -match '\d+[,.]\d{2}') { return $net }
  $unitText = (($unitValue -replace '\s+', '')).Trim()
  if ($unitText -notmatch '\d+[,.]\d{2}') { return '' }
  try {
    $culture = [System.Globalization.CultureInfo]::GetCultureInfo('pt-BR')
    $styles = [System.Globalization.NumberStyles]::Number
    $unit = [decimal]::Parse($unitText, $styles, $culture)
    $discount = [decimal]0
    $discountText = (($discountValue -replace '\s+', '')).Trim()
    if ($discountText -match '\d+[,.]\d{2}') {
      $discount = [decimal]::Parse($discountText, $styles, $culture)
    }
    $resolved = $unit - $discount
    if ($resolved -lt 0) { return '' }
    return $resolved.ToString('N2', $culture)
  } catch {
    return $unitText
  }
}
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($env:CONSTRUTEC_OCR_PATH)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) { throw 'Instale o pacote de idioma Português nas configurações do Windows.' }
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

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
      CX = [double]($rect.X + ($rect.Width / 2.0))
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
$tolerance = [Math]::Max(7, $avgHeight * 0.9)
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

# Localiza o cabeçalho da tabela Exsat e usa as posições X como limites das colunas.
$header = $null
foreach ($row in ($visualRows | Sort-Object CY)) {
  $text = Join-Words $row.Words
  if ($text -match '(?i)\bFab\.?\b' -and $text -match '(?i)\bCod\.?\b' -and $text -match '(?i)Descri[cç][aã]o' -and $text -match '(?i)Total') {
    $header = $row
    break
  }
}

if ($null -ne $header) {
  $hw = @($header.Words | Sort-Object X)
  $fabWord = @($hw | Where-Object { $_.Text -match '^(?i:Fab\.?)$' })[0]
  $codWord = @($hw | Where-Object { $_.Text -match '^(?i:Cod\.?)$' })[0]
  $descriptionWord = @($hw | Where-Object { $_.Text -match '^(?i:Descri[cç][aã]o:?|Descricao:?)$' })[0]
  $qtWord = @($hw | Where-Object { $_.Text -match '^(?i:Qt\.?\(?Un\.?\)?|Qt\.?)$' })[0]
  $unitWord = @($hw | Where-Object { $_.Text -match '^(?i:Unit\.?)$' })[0]
  $descValueWord = @($hw | Where-Object { $_.Text -match '^(?i:Desc\.?)$' })[0]
  $liqWord = @($hw | Where-Object { $_.Text -match '^(?i:L[ií]q\.?)$' })[0]
  $totalWord = @($hw | Where-Object { $_.Text -match '^(?i:Total)$' })[0]

  if ($fabWord -and $codWord -and $descriptionWord -and $qtWord -and $unitWord -and $descValueWord -and $liqWord -and $totalWord) {
    $fabX = [double]$fabWord.CX
    $codX = [double]$codWord.CX
    $descriptionX = [double]$descriptionWord.CX
    $qtX = [double]$qtWord.CX
    $unitX = [double]$unitWord.CX
    $descValueX = [double]$descValueWord.CX
    $liqX = [double]$liqWord.CX
    $totalX = [double]$totalWord.CX

    $bFabCod = ($fabX + $codX) / 2.0
    $bCodDescription = ($codX + $descriptionX) / 2.0
    # A descrição termina no início real da coluna Qt., evitando cortar modelos como 1332/1257.
    $bDescriptionQt = [double]$qtWord.X - [Math]::Max(4, $avgHeight * 0.35)
    $bQtUnit = ($qtX + $unitX) / 2.0
    $bUnitDesc = ($unitX + $descValueX) / 2.0
    $bDescLiq = ($descValueX + $liqX) / 2.0
    $bLiqTotal = ($liqX + $totalX) / 2.0

    # O fim da tabela é identificado dinamicamente; não existe limite fixo de itens.
    $tableEndRow = @($visualRows | Sort-Object CY | Where-Object {
      $_.CY -gt $header.CY -and (Join-Words $_.Words) -match '(?i)^\s*Total\b'
    })[0]
    $tableBottom = if ($tableEndRow) { [double]$tableEndRow.CY - ($avgHeight * 0.08) } else { [double]::MaxValue }

    # Fab. pode ser numérico ou alfanumérico (ex.: A35-E150/10), mas precisa conter ao menos um dígito.
    $anchors = @($words | Where-Object {
      $_.CY -gt ($header.CY + $avgHeight) -and
      $_.CY -lt $tableBottom -and
      $_.CX -lt $bFabCod -and
      $_.Text -match '^[A-Za-z0-9][A-Za-z0-9./_-]{2,31}$' -and
      $_.Text -match '\d'
    } | Sort-Object CY)

    $emitted = 0
    $emittedCodes = @{}
    for ($i = 0; $i -lt $anchors.Count; $i += 1) {
      $anchor = $anchors[$i]
      $top = if ($i -eq 0) { $header.CY + ($avgHeight * 0.6) } else { ([double]$anchors[$i - 1].CY + [double]$anchor.CY) / 2.0 }
      if ($i -eq $anchors.Count - 1) {
        $bottom = if ($tableEndRow) { $tableBottom } else { [double]$anchor.CY + ($avgHeight * 3.0) }
      } else {
        $bottom = ([double]$anchor.CY + [double]$anchors[$i + 1].CY) / 2.0
      }
      $band = @($words | Where-Object { $_.CY -gt $top -and $_.CY -lt $bottom })

      $fab = [string]$anchor.Text
      $supplier = Join-Words @($band | Where-Object { $_.CX -ge $bFabCod -and $_.CX -lt $bCodDescription })
      $description = Join-Words @($band | Where-Object { $_.CX -ge $bCodDescription -and $_.CX -lt $bDescriptionQt })
      $quantity = Join-Words @($band | Where-Object { $_.CX -ge $bDescriptionQt -and $_.CX -lt $bQtUnit })
      $unitValue = Join-Words @($band | Where-Object { $_.CX -ge $bQtUnit -and $_.CX -lt $bUnitDesc })
      $discountValue = Join-Words @($band | Where-Object { $_.CX -ge $bUnitDesc -and $_.CX -lt $bDescLiq })
      $netValue = Join-Words @($band | Where-Object { $_.CX -ge $bDescLiq -and $_.CX -lt $bLiqTotal })

      $supplier = ($supplier -replace '[^0-9]', '')
      $description = ($description -replace '\s+', ' ').Trim()
      $quantity = ($quantity -replace '\s+', '').Trim()
      $unitValue = ($unitValue -replace '\s+', '').Trim()
      $discountValue = ($discountValue -replace '\s+', '').Trim()
      $netValue = Resolve-NetValue $netValue $unitValue $discountValue

      if ($supplier -match '^\d{2,10}$' -and $description.Length -ge 3 -and $netValue -match '\d+[,.]\d{2}') {
        [Console]::WriteLine(($fab + [char]9 + $supplier + [char]9 + $description + [char]9 + $quantity + [char]9 + $unitValue + [char]9 + $discountValue + [char]9 + $netValue))
        $emittedCodes[$fab.ToUpperInvariant()] = $true
        $emitted += 1
      }
    }

    # Segunda passagem pelas linhas visuais: recupera qualquer produto perdido pela primeira segmentação,
    # inclusive a última linha imediatamente acima do Total. Funciona para qualquer quantidade de itens.
    foreach ($row in @($visualRows | Sort-Object CY | Where-Object {
      $_.CY -gt ($header.CY + $avgHeight) -and $_.CY -lt $tableBottom
    })) {
      $rowWords = @($row.Words | Sort-Object X)
      $fabCandidate = @($rowWords | Where-Object {
        $_.CX -lt $bFabCod -and
        $_.Text -match '^[A-Za-z0-9][A-Za-z0-9./_-]{2,31}$' -and
        $_.Text -match '\d'
      })[0]
      if (-not $fabCandidate) { continue }
      $fab = [string]$fabCandidate.Text
      if ($emittedCodes.ContainsKey($fab.ToUpperInvariant())) { continue }

      $rescueTop = [double]$row.CY - ($avgHeight * 0.75)
      $rescueBottom = [Math]::Min($tableBottom, [double]$row.CY + ($avgHeight * 1.35))
      $band = @($words | Where-Object { $_.CY -gt $rescueTop -and $_.CY -lt $rescueBottom })
      $supplier = Join-Words @($band | Where-Object { $_.CX -ge $bFabCod -and $_.CX -lt $bCodDescription })
      $description = Join-Words @($band | Where-Object { $_.CX -ge $bCodDescription -and $_.CX -lt $bDescriptionQt })
      $quantity = Join-Words @($band | Where-Object { $_.CX -ge $bDescriptionQt -and $_.CX -lt $bQtUnit })
      $unitValue = Join-Words @($band | Where-Object { $_.CX -ge $bQtUnit -and $_.CX -lt $bUnitDesc })
      $discountValue = Join-Words @($band | Where-Object { $_.CX -ge $bUnitDesc -and $_.CX -lt $bDescLiq })
      $netValue = Join-Words @($band | Where-Object { $_.CX -ge $bDescLiq -and $_.CX -lt $bLiqTotal })

      $supplier = ($supplier -replace '[^0-9]', '')
      $description = ($description -replace '\s+', ' ').Trim()
      $quantity = ($quantity -replace '\s+', '').Trim()
      $unitValue = ($unitValue -replace '\s+', '').Trim()
      $discountValue = ($discountValue -replace '\s+', '').Trim()
      $netValue = Resolve-NetValue $netValue $unitValue $discountValue

      if ($supplier -match '^\d{2,10}$' -and $description.Length -ge 3 -and $netValue -match '\d+[,.]\d{2}') {
        [Console]::WriteLine(($fab + [char]9 + $supplier + [char]9 + $description + [char]9 + $quantity + [char]9 + $unitValue + [char]9 + $discountValue + [char]9 + $netValue))
        $emittedCodes[$fab.ToUpperInvariant()] = $true
        $emitted += 1
      }
    }

    if ($emitted -gt 0) { exit 0 }
  }
}

# Fallback genérico para imagens que não seguem o layout padrão da Exsat.
foreach ($row in ($visualRows | Sort-Object CY)) {
  $ordered = @($row.Words | Sort-Object X)
  if ($ordered.Count -eq 0) { continue }
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
