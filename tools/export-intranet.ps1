# Export intranetu ZZS JčK (SharePoint) do ZIP souboru.
# Spusťte na PC v síti organizace pod svým doménovým účtem:
#   powershell -ExecutionPolicy Bypass -File .\export-intranet.ps1
# Výsledek: Plocha\intranet-export.zip (stránky, soubory, data seznamů, log chyb)

$Base     = 'http://intranet.zzsjck.local'
$Root     = Join-Path ([Environment]::GetFolderPath('Desktop')) 'intranet-export'
$MaxPages = 3000

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocol]::Tls12 -bor [Net.SecurityProtocol]::Tls11
$utf8 = New-Object System.Text.UTF8Encoding($false)

foreach ($d in 'pages','files','lists') { New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null }

$hostName = ([Uri]$Base).Host
$queue = New-Object System.Collections.Queue
$seen  = @{}
$lists = @{}
$log   = New-Object System.Collections.Generic.List[string]
$skip  = '_layouts/(?!viewlsts|people)|Authenticate|logout|signout|_vti_bin|EditForm|NewForm|Upload\.aspx|SortField=|FilterField=|\.axd|\.css($|\?)|\.js($|\?)|\.gif($|\?)|\.ico($|\?)'
$fileExt = '\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|rtf|txt|csv|odt|ods|jpe?g|png)$'

function Add-Url([string]$u) {
    if (-not $u) { return }
    $u = $u.Split('#')[0]
    if ($u -notmatch '^https?://') { return }
    try { $uri = [Uri]$u } catch { return }
    if ($uri.Host -ne $hostName) { return }
    if ($u -match $skip) { return }
    if (-not $seen.ContainsKey($u)) { $seen[$u] = $true; $queue.Enqueue($u) }
}

function Safe-Name([string]$s, [int]$max = 140) {
    $s = [Uri]::UnescapeDataString($s) -replace '[\\/:*?"<>|\r\n\t]', '_'
    if ($s.Length -gt $max) { $s = $s.Substring(0, $max) + '_' + ([Math]::Abs($s.GetHashCode())) }
    return $s
}

Add-Url "$Base/default.aspx"
Add-Url "$Base/_layouts/viewlsts.aspx"
Add-Url "$Base/_layouts/people.aspx"

$n = 0
while ($queue.Count -gt 0 -and $n -lt $MaxPages) {
    $u = [string]$queue.Dequeue()
    $n++
    Write-Host ("[{0}] {1}" -f $n, $u)
    try {
        $path = ([Uri]$u).AbsolutePath
        if ($path -match $fileExt) {
            $rel  = (Safe-Name $path.TrimStart('/').Replace('/', '__'))
            $dest = Join-Path (Join-Path $Root 'files') $rel
            Invoke-WebRequest -Uri $u -UseDefaultCredentials -UseBasicParsing -TimeoutSec 300 -OutFile $dest
        } else {
            $r = Invoke-WebRequest -Uri $u -UseDefaultCredentials -UseBasicParsing -TimeoutSec 90
            $html = [string]$r.Content
            $name = Safe-Name (([Uri]$u).PathAndQuery.TrimStart('/'))
            [IO.File]::WriteAllText((Join-Path (Join-Path $Root 'pages') ($name + '.html')), $html, $utf8)
            foreach ($m in [regex]::Matches($html, 'href\s*=\s*"([^"]+)"')) {
                $h = [Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
                if ($h -match '^(javascript|mailto|tel):') { continue }
                try { Add-Url ([Uri]::new([Uri]$u, $h)).AbsoluteUri } catch {}
            }
            foreach ($m in [regex]::Matches($html, 'ctx\.listName\s*=\s*"(\{[0-9A-Fa-f\-]+\})"')) {
                $lists[$m.Groups[1].Value] = $u
            }
        }
    } catch {
        $log.Add("CHYBA $u : $($_.Exception.Message)")
    }
}

# Data seznamů jako XML (Oznámení, Kalendář, telefonní seznamy, průzkumy...)
foreach ($g in $lists.Keys) {
    $x = "$Base/_vti_bin/owssvr.dll?Cmd=Display&List=$g&XMLDATA=TRUE&RowLimit=0"
    try {
        $r = Invoke-WebRequest -Uri $x -UseDefaultCredentials -UseBasicParsing -TimeoutSec 120
        $fn = (Safe-Name $g) + '.xml'
        [IO.File]::WriteAllText((Join-Path (Join-Path $Root 'lists') $fn), [string]$r.Content, $utf8)
        $log.Add("SEZNAM $g <= $($lists[$g])")
    } catch {
        $log.Add("CHYBA seznam $g : $($_.Exception.Message)")
    }
}

$log.Add("Zpracováno stránek a souborů: $n")
[IO.File]::WriteAllLines((Join-Path $Root 'log.txt'), $log, $utf8)

$zip = Join-Path ([Environment]::GetFolderPath('Desktop')) 'intranet-export.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $Root '*') -DestinationPath $zip
Write-Host "Hotovo: $zip"
