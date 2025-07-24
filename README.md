# Requestarr

A modern Discord bot for managing TV series (Sonarr) and movies (Radarr) with advanced slash commands, interactive embeds, and dynamic module management.


<p align="center">
  <a href="https://kan.wayy.fr/wayy/requestarr">Roadmap</a>
</p>

## Features
- 📺 Add, remove, and view calendar for Sonarr series
- 🎬 Add, remove, and view calendar for Radarr movies
- 🔍 Search MyAnimeList users and seasonal anime
- 📅 Daily anime releases
- 🛠️ Dynamic command/module management
- ✨ Interactive embeds and pagination
- 🔒 Owner/admin-only and public/private command control
- 📈 Logging and error reporting

## Quick Start with Docker Compose

```yml
services:
  requestarr:
    image: wayytempest/requestarr
    restart: unless-stopped
    environment:
    - SONARR_TOKEN=token
    - SONARR_URL=http://localhost:8989
    - RADARR_TOKEN=token
    - RADARR_URL=http://localhost:7878
    - TOKEN=token
    - CLIENTID=clientid
    - TraceError=false
    - PUBLIC_ARR=false
    - OWNER=id
    - NODE_ENV=production
    - NOTIF_ANIME=false
    - REDIS_URL=redis:6379
    depends_on:
      redis:
        condition: service_healthy
  redis:
    networks:
      - requestarr
    image: redis:8.2-rc1-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

networks:
  requestarr:
    external: true
```

## Manual Installation

1. **Clone the repository**
   - Gitea: `git clone https://git.wayy.fr/WaYy/Requestarr.git`
   - GitHub: `git clone https://github.com/WaYyTempest/Requestarr.git`
   - `cd Requestarr`
2. **Create and configure your `.env` file**
   - Copy `.env.example` to `.env` and fill in all required variables.
3. **Install dependencies**
   - `npm install`
4. **Build and start**
   - `npm run start`

## Usage
- Use slash commands like `/sonarr add`, `/radarr add`, `/mal search`, `/daily`, `/module` directly in your Discord server.
- For advanced management, use `/module` (owner only).

## Fork & Contribute
- Fork on [Gitea](https://git.wayy.fr/WaYy/Requestarr.git) or [GitHub](https://github.com/WaYyTempest/Requestarr.git)
- Clone your fork, create a branch, open a PR
- Please respect the project structure and spirit

## License
MIT License © 2025 WaYy Tempest
