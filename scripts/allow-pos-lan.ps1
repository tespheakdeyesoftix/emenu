#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [System.Net.IPAddress]$FrappeAddress = '192.168.10.19',
    [System.Net.IPAddress]$LocalAddress = '192.168.10.179'
)

$ErrorActionPreference = 'Stop'
if ($FrappeAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or
    $LocalAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or
    $FrappeAddress.Equals([System.Net.IPAddress]::Any) -or
    $LocalAddress.Equals([System.Net.IPAddress]::Any)) {
    throw 'Use specific IPv4 addresses for the Frappe and API computers.'
}
if (-not (Get-NetIPAddress -AddressFamily IPv4 -IPAddress $LocalAddress.IPAddressToString -ErrorAction SilentlyContinue)) {
    throw 'The API address must be assigned to this computer.'
}
$lanNodeExecutable = (Get-Command node -ErrorAction Stop).Source
$lanRuleName = 'Angkor-eMenu-POS-Frappe-' + $FrappeAddress.IPAddressToString + '-8787'
$existingLanRule = Get-NetFirewallRule -Name $lanRuleName -ErrorAction SilentlyContinue
if ($existingLanRule) {
    Write-Output 'The eMenu POS firewall rule already exists. Inspect its filters if connectivity is still blocked.'
    return
}
New-NetFirewallRule -Name $lanRuleName -DisplayName 'Angkor eMenu POS sync from Frappe' `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8787 `
    -LocalAddress $LocalAddress.IPAddressToString `
    -RemoteAddress $FrappeAddress.IPAddressToString `
    -Program $lanNodeExecutable -Profile Any | Out-Null
Write-Output 'Allowed POS LAN access only from the specified Frappe computer to the specified API address on TCP 8787.'
