---
description: How to deploy the AI-StickerGrid-Maker on Ubuntu using PM2
---

# Ubuntu Deployment Guide (PM2)

This guide explains how to deploy the application on an Ubuntu server using PM2.

## Prerequisites

- Node.js (v18+)
- PM2 (`npm install -g pm2`)
- Git

## Deployment Steps

// turbo
1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd AI-StickerGrid-Maker
   ```

// turbo
2. Install dependencies and build frontend:
   ```bash
   npm install
   npm run build
   ```

// turbo
3. Install server dependencies:
   ```bash
   cd server
   npm install --production
   cd ..
   ```

// turbo
4. Start the application with PM2:
   ```bash
   pm2 start ecosystem.config.js
   ```

5. Access the app at `http://your-server-ip:5001`.

## Persistence & Auto-start
To ensure the app starts on server reboot:
```bash
pm2 save
pm2 startup
```
(Follow the instructions printed by the startup command).

## Configuration
The API configuration is shared and stored in `server/config.json`.
