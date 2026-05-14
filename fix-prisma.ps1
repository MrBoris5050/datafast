# Fix Prisma EPERM Error
# Run this script as Administrator

Write-Host "Fixing Prisma permission issue..." -ForegroundColor Yellow

$projectPath = "C:\Users\Spec\Desktop\InventorDatahub\inventor-datahub"
$prismaPath = Join-Path $projectPath "node_modules\.prisma"

# Navigate to project
Set-Location $projectPath

# Remove .prisma folder if it exists
if (Test-Path $prismaPath) {
    Write-Host "Removing existing .prisma folder..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $prismaPath -ErrorAction SilentlyContinue
}

# Generate Prisma client
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "Prisma client generated successfully!" -ForegroundColor Green
    Write-Host "You can now run: npm run build" -ForegroundColor Green
} else {
    Write-Host "Error: Prisma generation failed. Try adding node_modules to Windows Defender exclusions." -ForegroundColor Red
}






