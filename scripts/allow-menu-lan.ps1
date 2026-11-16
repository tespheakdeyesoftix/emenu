#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$localMenuAddress = '192.168.10.179'
$menuSubnet = '192.168.10.0/24'
$menuPort = 5174
$menuRuleName = 'Angkor-eMenu-Menu-LAN-5174'
$menuInterface = Get-NetIPAddress -AddressFamily IPv4 -IPAddress $localMenuAddress |
    Where-Object PrefixLength -EQ 24 | Select-Object -First 1
if (-not $menuInterface) {
    throw "The menu address $localMenuAddress must be assigned to this computer with a /24 prefix."
}

$menuListener = Get-NetTCPConnection -State Listen -LocalAddress $localMenuAddress -LocalPort $menuPort
$menuProgram = (Get-Process -Id $menuListener.OwningProcess).Path
if ([IO.Path]::GetFileName($menuProgram) -ne 'node.exe') {
    throw 'The eMenu LAN listener must be running under Node before opening the firewall port.'
}

if (Get-NetFirewallRule -Name $menuRuleName -ErrorAction SilentlyContinue) {
    Write-Output "Firewall rule $menuRuleName already exists."
    exit 0
}

New-NetFirewallRule -Name $menuRuleName -DisplayName 'Angkor eMenu LAN menu (TCP 5174)' `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort $menuPort `
    -LocalAddress $localMenuAddress -RemoteAddress $menuSubnet `
    -InterfaceAlias $menuInterface.InterfaceAlias -Program $menuProgram `
    -Profile Any -EdgeTraversalPolicy Block | Out-Null
Write-Output "Allowed eMenu LAN traffic from $menuSubnet to ${localMenuAddress}:$menuPort."
