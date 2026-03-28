#!/usr/bin/env pwsh

# Vercel deployment script for Shelby Magic
Write-Host "🚀 Deploying Shelby Magic to Vercel..." -ForegroundColor Cyan

$projectRoot = Get-Location

# Check if vercel is installed
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

# Try to authenticate (will open browser if needed)
Write-Host "🔐 Checking Vercel authentication..." -ForegroundColor Yellow
vercel whoami

# Deploy to production
Write-Host "📦 Deploying to production..." -ForegroundColor Cyan
vercel --prod --force --token $env:VERCEL_TOKEN

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "Check your Vercel dashboard for the live URL" -ForegroundColor Cyan
