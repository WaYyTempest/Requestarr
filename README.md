<h1 align="center">Requestarr</h1>

A modern Discord bot for managing TV series (Sonarr) and movies (Radarr) with advanced slash commands, interactive embeds, and dynamic module management.

<p align="center">
  <a href="https://kan.wayy.fr/roadmap/requestarr">Roadmap</a>
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

## Environment Variables

| Variable                 | Description                               | Required | Example                               |
| ------------------------ | ----------------------------------------- | -------- | ------------------------------------- |
| `TOKEN`                  | Discord bot token                         | Yes      | `TOKEN=token`                         |
| `CLIENTID`               | Discord application client ID             | Yes      | `CLIENTID=clientid`                   |
| `OWNER`                  | Discord user ID of the bot owner          | Yes      | `OWNER=id`                            |
| `NODE_ENV`               | Environment mode (development/production) | Yes      | `NODE_ENV=production`                 |
| `REDIS_URL`              | Redis connection URL for production mode  | Yes\*    | `REDIS_URL=localhost:6379`            |
| `PUBLIC_ARR`             | Allow public access to \*arr commands     | No       | `PUBLIC_ARR=false`                    |
| `TraceError`             | Enable detailed error reporting           | No       | `TraceError=false`                    |
| `NOTIF_ANIME`            | Enable anime notification features        | No       | `NOTIF_ANIME=false`                   |
| `SCHEDULE_NOTIF`         | Cron schedule for anime notifications     | No       | `SCHEDULE_NOTIF=0 1 * * *`            |
| `MOVIE_SCHEDULE_NOTIF`   | Enable movie schedule notifications       | No       | `MOVIE_SCHEDULE_NOTIF=false`          |
| `SERIES_SCHEDULE_NOTIF`  | Enable series schedule notifications      | No       | `SERIES_SCHEDULE_NOTIF=false`         |
| `SONARR_TOKEN`           | Sonarr API token                          | No       | `SONARR_TOKEN=token`                  |
| `SONARR_URL`             | Sonarr server URL                         | No       | `SONARR_URL=http://localhost:8989`    |
| `RADARR_TOKEN`           | Radarr API token                          | No       | `RADARR_TOKEN=token`                  |
| `RADARR_URL`             | Radarr server URL                         | No       | `RADARR_URL=http://localhost:7878`    |
| `JELLYSTAT_URL`          | Jellystat server URL                      | No       | `JELLYSTAT_URL=http://localhost:3000` |
| `JELLYSTAT_TOKEN`        | Jellystat API token                       | No       | `JELLYSTAT_TOKEN=token`               |
| `PROWLARR_URL`           | Prowlarr server URL                       | No       | `PROWLARR_URL=http://localhost:9696`  |
| `PROWLARR_TOKEN`         | Prowlarr API token                        | No       | `PROWLARR_TOKEN=token`                |
| `BOT_STATUS_DEV`         | Discord status in development mode        | No       | `BOT_STATUS_DEV=idle`                 |
| `BOT_STATUS_PROD`        | Discord status in production mode         | No       | `BOT_STATUS_PROD=online`              |
| `BOT_ACTIVITY_DEV`       | Discord activity name in development mode | No       | `BOT_ACTIVITY_DEV=Under Development`  |
| `BOT_ACTIVITY_PROD`      | Discord activity name in production mode  | No       | `BOT_ACTIVITY_PROD=Self Hosted`       |
| `BOT_ACTIVITY_TYPE_DEV`  | Discord activity type in development mode | No       | `BOT_ACTIVITY_TYPE_DEV=Playing`       |
| `BOT_ACTIVITY_TYPE_PROD` | Discord activity type in production mode  | No       | `BOT_ACTIVITY_TYPE_PROD=Streaming`    |

\*Required only in production mode

## Quick Start with Docker Compose

```yml
services:
  requestarr:
    image: wayytempest/requestarr
    restart: unless-stopped
    environment:
      - TOKEN=token
      - CLIENTID=clientid
      - TraceError=false
      - PUBLIC_ARR=false
      - OWNER=id
      - NODE_ENV=production
      - NOTIF_ANIME=false
      - MOVIE_SCHEDULE_NOTIF=false
      - SERIES_SCHEDULE_NOTIF=false
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
   - `bun install` or `npm install`
4. **Build and start**
   - `bun run start` or `npm run start`

## Usage

- Use slash commands like `/sonarr add`, `/radarr add`, `/mal search`, `/daily`, `/module` directly in your Discord server.
- For advanced management, use `/module` (owner only).

## Fork & Contribute

- Fork on [Gitea](https://git.wayy.fr/WaYy/Requestarr.git) or [GitHub](https://github.com/WaYyTempest/Requestarr.git)
- Clone your fork, create a branch, open a PR
- Please respect the project structure and spirit

## License

MIT License © 2025 WaYy Tempest
