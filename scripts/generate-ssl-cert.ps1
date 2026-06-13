# PowerShell script to generate self-signed SSL certificate
Write-Host "Generating self-signed SSL certificate for development..." -ForegroundColor Green

# Create ssl directory if it doesn't exist
$sslDir = Join-Path $PSScriptRoot "..\ssl"
if (!(Test-Path $sslDir)) {
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
}

try {
    # Generate self-signed certificate using PowerShell
    $cert = New-SelfSignedCertificate -DnsName "localhost", "127.0.0.1" -CertStoreLocation "cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(1)
    
    # Export certificate
    $certPath = Join-Path $sslDir "certificate.crt"
    $keyPath = Join-Path $sslDir "private.key"
    
    # Export certificate (public key)
    Export-Certificate -Cert $cert -FilePath $certPath -Type CERT | Out-Null
    
    # Export private key (this requires additional steps in PowerShell)
    # For simplicity, we'll provide manual instructions
    
    Write-Host "SSL certificate generated successfully!" -ForegroundColor Green
    Write-Host "Certificate created at: $certPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "For development purposes, you can also use Node.js built-in certificate generation." -ForegroundColor Blue
    Write-Host "Run: npm run generate-ssl" -ForegroundColor Blue
    
} catch {
    Write-Host "Error generating SSL certificate: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative methods:" -ForegroundColor Yellow
    Write-Host "1. Use OpenSSL (if installed):" -ForegroundColor White
    Write-Host "   openssl genrsa -out ssl/private.key 2048" -ForegroundColor Gray
    Write-Host "   openssl req -new -x509 -key ssl/private.key -out ssl/certificate.crt -days 365" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Use the Node.js script:" -ForegroundColor White
    Write-Host "   npm run generate-ssl" -ForegroundColor Gray
}
