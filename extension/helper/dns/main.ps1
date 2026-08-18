param(
    [Parameter(Mandatory = $true)]
    [string] $Query
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$InformationPreference = "SilentlyContinue"
$VerbosePreference = "SilentlyContinue"
$DebugPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Write-JsonResult {
    param([Parameter(Mandatory = $true)] [System.Collections.IDictionary] $Value)
    $Value | ConvertTo-Json -Compress -Depth 5
}

function Write-Failure {
    param(
        [Parameter(Mandatory = $true)] [string] $Code,
        [Parameter(Mandatory = $true)] [string] $Message,
        [string] $Status = "error"
    )
    Write-JsonResult ([ordered]@{
        status = $Status
        error_code = $Code
        message = $Message
    })
}

function Get-ValidatedQuery {
    param([string] $Value)

    $clean = $Value.Trim()
    if ($clean.Length -eq 0) {
        throw [System.ArgumentException]::new("Enter a hostname or IP address.")
    }
    if ($clean.Length -gt 253) {
        throw [System.ArgumentException]::new("DNS query is too long.")
    }
    foreach ($character in $clean.ToCharArray()) {
        if ([char]::IsWhiteSpace($character) -or [char]::IsControl($character)) {
            throw [System.ArgumentException]::new(
                "DNS query must not contain whitespace or control characters."
            )
        }
    }

    $parsedAddress = $null
    if ([System.Net.IPAddress]::TryParse($clean, [ref] $parsedAddress)) {
        return [pscustomobject]@{
            Query = $clean
            Address = $parsedAddress.ToString()
            IsAddress = $true
        }
    }

    if ($clean.IndexOfAny([char[]]"/\:?#@[]") -ge 0) {
        throw [System.ArgumentException]::new("Enter a valid hostname or IP address.")
    }
    $hostname = $clean.TrimEnd(".")
    if ($hostname.Length -eq 0) {
        throw [System.ArgumentException]::new("Enter a valid hostname or IP address.")
    }
    $asciiHostname = [System.Globalization.IdnMapping]::new().GetAscii($hostname)
    foreach ($label in $asciiHostname.Split(".")) {
        if ($label -notmatch "^[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$") {
            throw [System.ArgumentException]::new("Enter a valid hostname or IP address.")
        }
    }
    return [pscustomobject]@{
        Query = $clean
        Address = $null
        IsAddress = $false
    }
}

try {
    if (-not (Get-Command Resolve-DnsName -ErrorAction SilentlyContinue)) {
        Write-Failure -Code "capability_unavailable" -Status "unavailable" `
            -Message "Resolve-DnsName is not available on this Windows workstation."
        exit 2
    }

    $validated = Get-ValidatedQuery $Query
    if ($validated.IsAddress) {
        try {
            $records = @(Resolve-DnsName -Name $validated.Address -Type PTR -ErrorAction Stop)
        }
        catch {
            Write-Failure -Code "lookup_failed" `
                -Message "Reverse DNS lookup failed for $($validated.Address)."
            exit 2
        }
        $hostnames = @(
            $records |
                Where-Object { $_.Type -eq "PTR" -and $_.NameHost } |
                ForEach-Object { [string] $_.NameHost } |
                Sort-Object -Unique
        )
        if ($hostnames.Count -eq 0) {
            Write-Failure -Code "lookup_failed" `
                -Message "Reverse DNS lookup returned no hostname for $($validated.Address)."
            exit 2
        }
        Write-JsonResult ([ordered]@{
            status = "success"
            query = $validated.Address
            lookup_type = "reverse"
            addresses = @($validated.Address)
            hostname = $hostnames[0]
            aliases = @($hostnames | Select-Object -Skip 1)
            execution_source = "local-windows"
        })
        exit 0
    }

    try {
        $records = @(Resolve-DnsName -Name $validated.Query -ErrorAction Stop)
    }
    catch {
        Write-Failure -Code "lookup_failed" `
            -Message "DNS lookup failed for $($validated.Query)."
        exit 2
    }
    $addresses = @(
        $records |
            Where-Object { $_.Type -in @("A", "AAAA") -and $_.IPAddress } |
            ForEach-Object { [string] $_.IPAddress } |
            Sort-Object -Unique
    )
    if ($addresses.Count -eq 0) {
        Write-Failure -Code "lookup_failed" `
            -Message "DNS lookup returned no addresses for $($validated.Query)."
        exit 2
    }
    $aliases = @(
        $records |
            Where-Object { $_.Type -eq "CNAME" -and $_.NameHost } |
            ForEach-Object { [string] $_.NameHost } |
            Sort-Object -Unique
    )
    Write-JsonResult ([ordered]@{
        status = "success"
        query = $validated.Query
        lookup_type = "forward"
        addresses = @($addresses)
        hostname = $null
        aliases = @($aliases)
        execution_source = "local-windows"
    })
    exit 0
}
catch [System.ArgumentException] {
    Write-Failure -Code "invalid_query" -Message $_.Exception.Message
    exit 2
}
catch {
    Write-Failure -Code "unexpected_error" -Message "Local DNS lookup failed unexpectedly."
    exit 2
}
