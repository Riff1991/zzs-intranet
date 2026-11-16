# Export intranetu ZZS JčK přes SharePoint webové služby (Lists.asmx, Webs.asmx).
# Na rozdíl od v1 vrací VŠECHNA pole položek (texty oznámení, autory, data, odkazy na přílohy)
# a projde všechny podwebe i seznamy. Spusťte na PC v síti pod svým doménovým účtem:
#
#   cd $HOME\Desktop\zzs-intranet
#   git pull
#   powershell -ExecutionPolicy Bypass -File .\tools\export-intranet-v2.ps1
#
# Data (malé XML) jdou do import\v2\ a pak se commitují. Soubory a přílohy (velké)
# se stahují mimo repozitář do Plocha\intranet-soubory. Přepínač -BezSouboru je nestahuje.

param(
    [string]$Base = 'http://intranet.zzsjck.local',
    [string]$Out = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'zzs-intranet\import\v2'),
    [string]$FilesDir = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'intranet-soubory'),
    [switch]$BezSouboru
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocol]::Tls12 -bor [Net.SecurityProtocol]::Tls11
$utf8 = New-Object System.Text.UTF8Encoding($false)
$ns = 'http://schemas.microsoft.com/sharepoint/soap/'
$log = New-Object System.Collections.Generic.List[string]
$index = New-Object System.Collections.Generic.List[object]
$root = [Uri]$Base
$origin = $root.GetLeftPart([UriPartial]::Authority)

New-Item -ItemType Directory -Force -Path (Join-Path $Out 'data') | Out-Null
if (-not $BezSouboru) { New-Item -ItemType Directory -Force -Path $FilesDir | Out-Null }

function Safe([string]$s, [int]$max = 100) {
    $s = [Uri]::UnescapeDataString($s) -replace '[\\/:*?"<>|\r\n\t]', '_'
    if ($s.Length -gt $max) { $s = $s.Substring(0, $max) }
    return $s.Trim()
}

function Invoke-Soap([string]$url, [string]$method, [string]$inner) {
    $env = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' + $inner + '</soap:Body></soap:Envelope>'
    $r = Invoke-WebRequest -Uri $url -Method Post -Body ($utf8.GetBytes($env)) `
        -ContentType 'text/xml; charset=utf-8' -Headers @{ SOAPAction = ($ns + $method) } `
        -UseDefaultCredentials -UseBasicParsing -TimeoutSec 600
    return $utf8.GetString($r.RawContentStream.ToArray())
}

function Get-File([string]$url, [string]$dest) {
    if (Test-Path -LiteralPath $dest) { return }
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    try { Invoke-WebRequest -Uri $url -UseDefaultCredentials -UseBasicParsing -TimeoutSec 600 -OutFile $dest }
    catch { $log.Add("CHYBA soubor $url : $($_.Exception.Message)") }
}

# 1) Všechny weby (kořen + podwebe)
$webs = New-Object System.Collections.Generic.List[object]
$webs.Add([pscustomobject]@{ Title = 'Intranet ZZS JčK'; Url = $Base.TrimEnd('/') })
try {
    $x = [xml](Invoke-Soap "$Base/_vti_bin/Webs.asmx" 'GetAllSubWebCollection' "<GetAllSubWebCollection xmlns=`"$ns`" />")
    foreach ($w in $x.Envelope.Body.GetAllSubWebCollectionResponse.GetAllSubWebCollectionResult.Webs.Web) {
        $webs.Add([pscustomobject]@{ Title = $w.Title; Url = ([string]$w.Url).TrimEnd('/') })
    }
} catch { $log.Add("CHYBA weby: $($_.Exception.Message)") }
Write-Host ("Webů: {0}" -f $webs.Count)

# 2) Seznamy a knihovny každého webu, 3) všechny položky
foreach ($web in $webs) {
    $webSlug = if ($web.Url.TrimEnd('/') -eq $Base.TrimEnd('/')) { '_root' } else { Safe ($web.Url.Substring($Base.TrimEnd('/').Length).Trim('/')) }
    Write-Host ("== {0} ({1})" -f $web.Title, $web.Url)
    try {
        $lx = [xml](Invoke-Soap "$($web.Url)/_vti_bin/Lists.asmx" 'GetListCollection' "<GetListCollection xmlns=`"$ns`" />")
        $lists = @($lx.Envelope.Body.GetListCollectionResponse.GetListCollectionResult.Lists.List)
    } catch { $log.Add("CHYBA seznamy $($web.Url): $($_.Exception.Message)"); continue }

    foreach ($l in $lists) {
        if ($l.Hidden -eq 'TRUE') { continue }
        $title = [string]$l.Title; $id = [string]$l.ID
        Write-Host ("   {0} [{1}]" -f $title, $l.ItemCount)
        $dir = Join-Path (Join-Path $Out 'data') $webSlug
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        $fn = (Safe $title) + '.xml'
        try {
            $q = "<GetListItems xmlns=`"$ns`"><listName>$id</listName><query><Query/></query><viewFields><ViewFields/></viewFields>" +
                 "<rowLimit>100000</rowLimit><queryOptions><QueryOptions><ViewAttributes Scope=`"RecursiveAll`"/>" +
                 "<IncludeAttachmentUrls>TRUE</IncludeAttachmentUrls></QueryOptions></queryOptions></GetListItems>"
            $raw = Invoke-Soap "$($web.Url)/_vti_bin/Lists.asmx" 'GetListItems' $q
            [IO.File]::WriteAllText((Join-Path $dir $fn), $raw, $utf8)
            $index.Add([pscustomobject]@{ web = $web.Title; webUrl = $web.Url; webSlug = $webSlug; title = $title; id = $id
                baseType = [string]$l.BaseType; template = [string]$l.ServerTemplate; items = [string]$l.ItemCount
                viewUrl = [string]$l.DefaultViewUrl; description = [string]$l.Description; file = "data/$webSlug/$fn" })

            if (-not $BezSouboru) {
                # Soubory knihovny (ows_FileRef) a přílohy položek (ows_Attachments)
                foreach ($m in [regex]::Matches($raw, 'ows_FileRef="\d+;#([^"]+)"[^>]*?(?:ows_FSObjType="\d+;#(\d)")?')) {
                    $path = $m.Groups[1].Value
                    if ($path -match '\.[A-Za-z0-9]{2,5}$') {
                        $url = $origin + '/' + (($path -split '/' | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/')
                        Get-File $url (Join-Path $FilesDir ('knihovny\' + (Safe $path.Replace('/', '__') 180)))
                    }
                }
                foreach ($m in [regex]::Matches($raw, 'ows_Attachments="([^"]*)"')) {
                    foreach ($u in ($m.Groups[1].Value -split ';#')) {
                        if ($u -match '^https?://') {
                            Get-File $u (Join-Path $FilesDir ('prilohy\' + (Safe ($u.Substring($origin.Length).TrimStart('/').Replace('/', '__')) 180)))
                        }
                    }
                }
            }
        } catch { $log.Add("CHYBA polozky $($web.Url) / $title : $($_.Exception.Message)") }
    }
}

($index | ConvertTo-Json -Depth 4) | Out-File -FilePath (Join-Path $Out 'index.json') -Encoding utf8
$log.Add("Seznamů: $($index.Count)")
[IO.File]::WriteAllLines((Join-Path $Out 'log.txt'), $log, $utf8)
Write-Host "Hotovo. Data: $Out"
if (-not $BezSouboru) { Write-Host "Soubory: $FilesDir" }
Write-Host "Teď: cd `$HOME\Desktop\zzs-intranet; git add -A; git commit -m 'Export v2'; git push"
