# tg

the garage. CrossFit for your garage gym.

No accounts. Add your members, then pick who's lifting when you log a score or a PR. Each day is one shared workout, using only the equipment marked owned. Members are managed on the Members page; the app remembers the last person you selected on each device.

## Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. On first run the app asks you to add your first member, then to mark the equipment you own. A fresh install starts with no members and nothing owned. Set `AI_API_KEY` before generating a workout (see below). `TZ` controls which calendar day is "today".

## AI provider

Workout generation talks to any **OpenAI-compatible Chat Completions** endpoint, so you can use whichever model you like. Configure it with env vars:

| Variable | Default | Notes |
| --- | --- | --- |
| `AI_API_KEY` | — | Your provider key. `FIREWORKS_API_KEY` is also accepted as an alias. |
| `AI_BASE_URL` | `https://api.openai.com/v1` | The provider's OpenAI-compatible base URL. |
| `AI_MODEL` | `gpt-4o-mini` | The model name as that provider expects it. |
| `AI_JSON_MODE` | `schema` | `schema`, `object`, or `none`. The app degrades automatically if the provider rejects `json_schema`. |
| `AI_REASONING_EFFORT` | unset | Sent only when set. Auto-set to `none` for a Fireworks base URL. |

Copy-paste starting points:

```bash
# OpenAI
AI_API_KEY=sk-...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

# OpenRouter
AI_API_KEY=sk-or-...
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openai/gpt-4o-mini

# Groq
AI_API_KEY=gsk_...
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile

# Ollama (local; any key works)
AI_API_KEY=ollama
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3.1
AI_JSON_MODE=object

# Fireworks
AI_API_KEY=fw_...
AI_BASE_URL=https://api.fireworks.ai/inference/v1
AI_MODEL=accounts/fireworks/models/deepseek-v4p1-flash
AI_REASONING_EFFORT=none
```

Upgrading from an older version that only set `FIREWORKS_API_KEY`? The default is now OpenAI, so add the Fireworks `AI_BASE_URL` and `AI_MODEL` above to keep using Fireworks.

JSON support varies by host and model. The app tries structured output first and falls back to plain JSON, so most providers work untouched; if yours is picky, set `AI_JSON_MODE=object` (or `none`). When running Ollama in Docker, point `AI_BASE_URL` at the host (`http://host.docker.internal:11434/v1`) or run the container with `--network host`.

## Docker

The container keeps its SQLite database on a host directory bind-mounted at `/data`, so it survives image rebuilds. The service binds to localhost only; put a private tunnel or VPN in front of it.

```bash
cp .env.example .env
# Edit .env: set AI_API_KEY (and AI_BASE_URL / AI_MODEL for your provider) and TG_DATA_PATH
mkdir -p "$TG_DATA_PATH"
sudo chown -R 1000:1000 "$TG_DATA_PATH"   # container runs as uid:gid 1000:1000
docker compose up -d --build
```

The database is `$TG_DATA_PATH/tg.sqlite`. Keep the `.sqlite`, `.sqlite-wal`, and `.sqlite-shm` files together in the same directory.

### Updating

The database lives on the host, not in the image, so rebuilding the container never touches it. To ship new code:

```bash
git pull
docker compose up -d --build
```

Schema changes apply themselves on startup without deleting rows, so workouts, members, scores, and PRs survive every update. Back up first if you want a safety net, and never run `docker compose down -v` (that deletes the named volume) or point `TG_DATA_PATH` at an empty directory.

### Access

Compose publishes `127.0.0.1:3000` only. Reach it over a private tunnel or VPN — for example, with Tailscale:

```bash
tailscale serve --bg --https=443 http://127.0.0.1:3000
```

Do not publish on `0.0.0.0` or expose it to the internet. The app does not authenticate, so the tunnel or VPN is the access boundary.

### Backups

Back up the host directory (`TG_DATA_PATH`) on your normal schedule; a filesystem snapshot or copy of that directory is enough. For a portable copy, stop the container (or run `PRAGMA wal_checkpoint(TRUNCATE)`) and copy `tg.sqlite` plus any `-wal`/`-shm` siblings.

## Checks

```bash
npm run lint
npm run typecheck
npm test
```
