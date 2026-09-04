export const windowsOcrPowerShellScript = String.raw`
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
function Join-VisualWords($items) {
  return ((@($items | Sort-Object CY, X | ForEach-Object { [string]$_.Text }) -join ' ') -replace '\s+', ' ').Trim()
}
function Last-Money($value) {
  $matches = [regex]::Matches([string]$value, '(?:\d{1,3}(?:\.\d{3})+|\d+)[,.]\d{2}')
  if ($matches.Count -eq 0) { return '' }
  return [string]$matches[$matches.Count - 1].Value
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
    if ($discountText -match '\d+[,.]\d{2}') { $discount = [decimal]::Parse($discountText, $styles, $culture) }
    $resolved = $unit - $discount
    if ($resolved -lt 0) { return '' }
    return $resolved.ToString('N2', $culture)
  } catch { return $unitText }
}
function Resolve-TotalValue($totalValue, $netValue, $quantityValue) {
  $total = (($totalValue -replace '\s+', '')).Trim()
  if ($total -match '\d+[,.]\d{2}') { return $total }
  $netText = (($netValue -replace '\s+', '')).Trim()
  $quantityText = (($quantityValue -replace '\s+', '')).Trim()
  if ($netText -notmatch '\d+[,.]\d{2}' -or $quantityText -notmatch '\d+(?:[,.]\d+)?') { return $netText }
  try {
    $culture = [System.Globalization.CultureInfo]::GetCultureInfo('pt-BR')
    $styles = [System.Globalization.NumberStyles]::Number
    $net = [decimal]::Parse($netText, $styles, $culture)
    $quantity = [decimal]::Parse($quantityText, $styles, $culture)
    return ($net * $quantity).ToString('N2', $culture)
  } catch { return $netText }
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
    if ($distance -le $tolerance -and $distance -lt $bestDistance) { $best = $row; $bestDistance = $distance }
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

# Layout Telcabos: detecta o cabeçalho mesmo quando o OCR divide as palavras em linhas diferentes.
$telHeader = $null
foreach ($row in ($visualRows | Sort-Object CY)) {
  $text = Join-Words $row.Words
  if (($text -match '(?i)C[oó]digo' -and $text -match '(?i)Qtde' -and $text -match '(?i)Descri[cç][aã]o') -or
      ($text -match '(?i)C[oó]d\.?\s*Fab' -and $text -match '(?i)Qtde')) {
    $telHeader = $row
    break
  }
}

if ($null -ne $telHeader -or ([string]$result.Text -match '(?i)TELCABOS')) {
  $headerY = if ($telHeader) { [double]$telHeader.CY } else {
    $candidate = @($words | Where-Object { $_.Text -match '^(?i:C[oó]digo)$' } | Sort-Object CY)[0]
    if ($candidate) { [double]$candidate.CY } else { 0 }
  }
  $headerWindow = [Math]::Max(10, $avgHeight * 2.2)
  $hw = @($words | Where-Object { [Math]::Abs([double]$_.CY - $headerY) -le $headerWindow } | Sort-Object X)

  $itemWord = @($hw | Where-Object { $_.Text -match '^(?i:(?:I|Í)tem|Item)$' })[0]
  $codeWord = @($hw | Where-Object { $_.Text -match '^(?i:C[oó]digo)$' })[0]
  $fabWord = @($hw | Where-Object { $_.Text -match '^(?i:C[oó]d\.?Fab|Cod\.Fab)$' })[0]
  $qtyWord = @($hw | Where-Object { $_.Text -match '^(?i:Qtde)$' })[0]
  $unWord = @($hw | Where-Object { $_.Text -match '^(?i:Un)$' })[0]
  $descriptionWord = @($hw | Where-Object { $_.Text -match '^(?i:Descri[cç][aã]o|Descricao)$' })[0]
  $cstWord = @($hw | Where-Object { $_.Text -match '^(?i:CST)$' })[0]
  $classWord = @($hw | Where-Object { $_.Text -match '^(?i:Class\.?Fiscal|Class\.?)$' })[0]
  $brandWord = @($hw | Where-Object { $_.Text -match '^(?i:Marca)$' })[0]
  $deliveryWord = @($hw | Where-Object { $_.Text -match '^(?i:Previs[aã]o|Previsao)$' })[0]
  $unitPriceWord = @($hw | Where-Object { $_.Text -match '^(?i:Unit[aá]rio|Unitario)$' })[0]
  $stWord = @($hw | Where-Object { $_.Text -match '^(?i:(?:Vl\.?ST|V\.?ST|ST))$' })[0]

  if ($codeWord -and $qtyWord -and $unWord -and $descriptionWord -and $cstWord -and $brandWord -and $deliveryWord -and $unitPriceWord) {
    $itemX = if ($itemWord) { [double]$itemWord.CX } else { [double]$codeWord.X - [Math]::Max(20, $avgHeight * 2) }
    $codeX = [double]$codeWord.CX
    $fabX = if ($fabWord) { [double]$fabWord.CX } else { ($codeX + [double]$qtyWord.CX) / 2.0 }
    $qtyX = [double]$qtyWord.CX
    $unX = [double]$unWord.CX
    $descriptionX = [double]$descriptionWord.CX
    $cstX = [double]$cstWord.CX
    $classX = if ($classWord) { [double]$classWord.CX } else { ($cstX + [double]$brandWord.CX) / 2.0 }
    $brandX = [double]$brandWord.CX
    $deliveryX = [double]$deliveryWord.CX
    $priceX = [double]$unitPriceWord.CX
    $stX = if ($stWord) { [double]$stWord.CX } else { $priceX + [Math]::Max(60, $avgHeight * 5) }
    $bItemCode = ($itemX + $codeX) / 2.0
    $bCodeFab = ($codeX + $fabX) / 2.0
    $bFabQty = ($fabX + $qtyX) / 2.0
    $bQtyUn = ($qtyX + $unX) / 2.0
    $bUnDescription = ($unX + $descriptionX) / 2.0
    $bDescriptionCst = ($descriptionX + $cstX) / 2.0
    $bClassBrand = ($classX + $brandX) / 2.0
    $bBrandDelivery = ($brandX + $deliveryX) / 2.0
    $bDeliveryPrice = ($deliveryX + $priceX) / 2.0
    $bPriceSt = ($priceX + $stX) / 2.0

    $telEndRow = @($visualRows | Sort-Object CY | Where-Object {
      $_.CY -gt $headerY -and (Join-Words $_.Words) -match '(?i)(?:Desc\.?\s*Impostos|Total\s+Mercadorias|Validade\s+da\s+Proposta|Pag\s*:)' 
    })[0]
    $telTableBottom = if ($telEndRow) { [double]$telEndRow.CY - ($avgHeight * 0.15) } else { [double]::MaxValue }

    $anchors = @($words | Where-Object {
      $_.CY -gt ($headerY + $avgHeight * 0.55) -and
      $_.CY -lt $telTableBottom -and
      $_.CX -ge $bItemCode -and $_.CX -lt $bCodeFab -and
      $_.Text -match '^\d{3,10}$'
    } | Sort-Object CY)

    $emitted = 0
    $emittedItems = @{}
    for ($i = 0; $i -lt $anchors.Count; $i += 1) {
      $anchor = $anchors[$i]
      $itemNo = ('{0}:{1:N2}' -f ([string]$anchor.Text), [double]$anchor.CY)
      if ($emittedItems.ContainsKey($itemNo)) { continue }
      $top = [Math]::Max($headerY + ($avgHeight * 0.45), [double]$anchor.CY - ($avgHeight * 0.7))
      $bottom = if ($i -lt ($anchors.Count - 1)) {
        [double]$anchors[$i + 1].CY - ($avgHeight * 0.7)
      } else {
        [Math]::Min($telTableBottom, [double]$anchor.CY + ($avgHeight * 4.5))
      }
      $band = @($words | Where-Object { $_.CY -gt $top -and $_.CY -lt $bottom })

      $code = Join-VisualWords @($band | Where-Object { $_.CX -ge $bItemCode -and $_.CX -lt $bCodeFab })
      $fabCode = Join-VisualWords @($band | Where-Object { $_.CX -ge $bCodeFab -and $_.CX -lt $bFabQty })
      $unit = Join-VisualWords @($band | Where-Object { $_.CX -ge $bQtyUn -and $_.CX -lt $bUnDescription })
      $description = Join-VisualWords @($band | Where-Object { $_.CX -ge $bUnDescription -and $_.CX -lt $bDescriptionCst })
      $brand = Join-VisualWords @($band | Where-Object { $_.CX -ge $bClassBrand -and $_.CX -lt $bBrandDelivery })
      $unitPriceText = Join-VisualWords @($band | Where-Object { $_.CX -ge $bDeliveryPrice -and $_.CX -lt $bPriceSt })

      $code = ($code -replace '[^A-Za-z0-9./_-]', '').Trim()
      $fabCode = ($fabCode -replace '\s+', ' ').Trim()
      $unit = ($unit -replace '[^A-Za-z]', '').Trim()
      $description = ($description -replace '\s+', ' ').Trim()
      $brand = ($brand -replace '\s+', ' ').Trim()
      $unitPrice = Last-Money $unitPriceText
      if ($unitPrice -notmatch '\d+[,.]\d{2}' -or $unitPrice -match '^[0O][,.][0O]{2}$') {
        $widePriceText = Join-VisualWords @($band | Where-Object {
          $_.CX -ge $bBrandDelivery -and $_.CX -lt $stX
        })
        $priceCandidates = [regex]::Matches([string]$widePriceText, '(?:\d{1,3}(?:\.\d{3})+|\d+)[,.]\d{2}')
        foreach ($candidate in $priceCandidates) {
          if ([string]$candidate.Value -notmatch '^[0O][,.][0O]{2}$') {
            $unitPrice = [string]$candidate.Value
            break
          }
        }
      }

      if ($code -match '^\d{3,10}$' -and $description.Length -ge 3 -and $unitPrice -match '\d+[,.]\d{2}' -and $unitPrice -notmatch '^[0O][,.][0O]{2}$') {
        $source = if ($fabCode) { 'TELCABOS COD.FAB ' + $fabCode } else { 'TELCABOS' }
        [Console]::WriteLine(('@CATALOG@' + [char]9 + $code + [char]9 + $description + [char]9 + 'Importado' + [char]9 + $brand + [char]9 + '' + [char]9 + $unit + [char]9 + $unitPrice + [char]9 + $source))
        $emittedItems[$itemNo] = $true
        $emitted += 1
      }
    }
    if ($emitted -gt 0) { exit 0 }
  }
}

# Layout Exsat.
$header = $null
foreach ($row in ($visualRows | Sort-Object CY)) {
  $text = Join-Words $row.Words
  if ($text -match '(?i)\bFab\.?\b' -and $text -match '(?i)\bCod\.?\b' -and $text -match '(?i)Descri[cç][aã]o' -and $text -match '(?i)Total') { $header = $row; break }
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
    $fabX = [double]$fabWord.CX; $codX = [double]$codWord.CX; $descriptionX = [double]$descriptionWord.CX
    $qtX = [double]$qtWord.CX; $unitX = [double]$unitWord.CX; $descValueX = [double]$descValueWord.CX
    $liqX = [double]$liqWord.CX; $totalX = [double]$totalWord.CX
    $bFabCod = ($fabX + $codX) / 2.0
    $bCodDescription = ($codX + $descriptionX) / 2.0
    $bDescriptionQt = [double]$qtWord.X - [Math]::Max(4, $avgHeight * 0.35)
    $bQtUnit = ($qtX + $unitX) / 2.0
    $bUnitDesc = ($unitX + $descValueX) / 2.0
    $bDescLiq = ($descValueX + $liqX) / 2.0
    $bLiqTotal = ($liqX + $totalX) / 2.0
    $tableEndRow = @($visualRows | Sort-Object CY | Where-Object { $_.CY -gt $header.CY -and (Join-Words $_.Words) -match '(?i)^\s*Total\b' })[0]
    $tableBottom = if ($tableEndRow) { [double]$tableEndRow.CY - ($avgHeight * 0.08) } else { [double]::MaxValue }
    $anchors = @($words | Where-Object {
      $_.CY -gt ($header.CY + $avgHeight) -and $_.CY -lt $tableBottom -and $_.CX -lt $bFabCod -and
      $_.Text -match '^[A-Za-z0-9][A-Za-z0-9./_-]{2,31}$' -and $_.Text -match '\d'
    } | Sort-Object CY)
    $emitted = 0; $emittedCodes = @{}
    for ($i = 0; $i -lt $anchors.Count; $i += 1) {
      $anchor = $anchors[$i]
      $top = if ($i -eq 0) { $header.CY + ($avgHeight * 0.6) } else { ([double]$anchors[$i - 1].CY + [double]$anchor.CY) / 2.0 }
      $bottom = if ($i -eq $anchors.Count - 1) { if ($tableEndRow) { $tableBottom } else { [double]$anchor.CY + ($avgHeight * 3.0) } } else { ([double]$anchor.CY + [double]$anchors[$i + 1].CY) / 2.0 }
      $band = @($words | Where-Object { $_.CY -gt $top -and $_.CY -lt $bottom })
      $fab = [string]$anchor.Text
      $supplier = Join-Words @($band | Where-Object { $_.CX -ge $bFabCod -and $_.CX -lt $bCodDescription })
      $description = Join-Words @($band | Where-Object { $_.CX -ge $bCodDescription -and $_.CX -lt $bDescriptionQt })
      $quantity = Join-Words @($band | Where-Object { $_.CX -ge $bDescriptionQt -and $_.CX -lt $bQtUnit })
      $unitValue = Join-Words @($band | Where-Object { $_.CX -ge $bQtUnit -and $_.CX -lt $bUnitDesc })
      $discountValue = Join-Words @($band | Where-Object { $_.CX -ge $bUnitDesc -and $_.CX -lt $bDescLiq })
      $netValue = Join-Words @($band | Where-Object { $_.CX -ge $bDescLiq -and $_.CX -lt $bLiqTotal })
      $totalValue = Join-Words @($band | Where-Object { $_.CX -ge $bLiqTotal })
      $supplier = ($supplier -replace '[^0-9]', '')
      $description = ($description -replace '\s+', ' ').Trim()
      $quantity = ($quantity -replace '\s+', '').Trim()
      $unitValue = ($unitValue -replace '\s+', '').Trim()
      $discountValue = ($discountValue -replace '\s+', '').Trim()
      $netValue = Resolve-NetValue $netValue $unitValue $discountValue
      $totalValue = Resolve-TotalValue $totalValue $netValue $quantity
      if ($supplier -match '^\d{2,10}$' -and $description.Length -ge 3 -and $totalValue -match '\d+[,.]\d{2}') {
        [Console]::WriteLine(($fab + [char]9 + $supplier + [char]9 + $description + [char]9 + $quantity + [char]9 + $unitValue + [char]9 + $discountValue + [char]9 + $netValue + [char]9 + $totalValue))
        $emittedCodes[$fab.ToUpperInvariant()] = $true; $emitted += 1
      }
    }
    foreach ($row in @($visualRows | Sort-Object CY | Where-Object { $_.CY -gt ($header.CY + $avgHeight) -and $_.CY -lt $tableBottom })) {
      $rowWords = @($row.Words | Sort-Object X)
      $fabCandidate = @($rowWords | Where-Object { $_.CX -lt $bFabCod -and $_.Text -match '^[A-Za-z0-9][A-Za-z0-9./_-]{2,31}$' -and $_.Text -match '\d' })[0]
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
      $totalValue = Join-Words @($band | Where-Object { $_.CX -ge $bLiqTotal })
      $supplier = ($supplier -replace '[^0-9]', '')
      $description = ($description -replace '\s+', ' ').Trim()
      $quantity = ($quantity -replace '\s+', '').Trim()
      $unitValue = ($unitValue -replace '\s+', '').Trim()
      $discountValue = ($discountValue -replace '\s+', '').Trim()
      $netValue = Resolve-NetValue $netValue $unitValue $discountValue
      $totalValue = Resolve-TotalValue $totalValue $netValue $quantity
      if ($supplier -match '^\d{2,10}$' -and $description.Length -ge 3 -and $totalValue -match '\d+[,.]\d{2}') {
        [Console]::WriteLine(($fab + [char]9 + $supplier + [char]9 + $description + [char]9 + $quantity + [char]9 + $unitValue + [char]9 + $discountValue + [char]9 + $netValue + [char]9 + $totalValue))
        $emittedCodes[$fab.ToUpperInvariant()] = $true; $emitted += 1
      }
    }
    if ($emitted -gt 0) { exit 0 }
  }
}

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
    $parts.Add([string]$word.Text); $previous = $word
  }
  (($parts -join ' ') -replace '\s{4,}', '   ').Trim()
}
`;
