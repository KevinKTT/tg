# tg

the garage. CrossFit for your garage gym.

No accounts. Add your members, then pick who's lifting when you log a score or a PR. Each day is one shared workout, using only the equipment marked owned. Members are managed on the Members page; the app remembers the last person you selected on each device.

Workout generation is a small programming engine plus an AI head coach. The engine chooses the week's shape, scheme, time domain, movement patterns, modalities, loads, warm-up, and cool-down. The model chooses only the title, stimulus, and movements from a shortlist. Every scored piece has one structured scheme (for time, AMRAP, EMOM, intervals, chipper, ladder, strength, max load, max reps, or skill), so the whiteboard, clock, and score form can never disagree.

Each session is composed several ways, audited by code for the things schema validation cannot see (movement stacks, grip overload, volume that does not fit the cap), and then optionally judged by a decision model. See [Decision layer](#decision-layer).

Each day is programmed toward one complete ~45 minute class (warm-up, prep, work, cool-down). Every scored movement is written with Rx, Performance, and Lifestyle versions, and the loads come from the equipment you own and the PRs you have logged. If the model is unavailable or returns something invalid, the app composes a valid original session from the same assignment instead of failing.


## Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. On first run the app asks you to add your first member, then to mark the equipment you own. A fresh install starts with no members and nothing owned. Set `AI_API_KEY` to have the model compose the movements; without a key, or if the provider fails, the app falls back to its own valid session composer (see below). `TZ` controls which calendar day is "today".

## AI provider

Workout generation talks to any **OpenAI-compatible Chat Completions** endpoint, so you can use whichever model you like. Configure it with env vars:

| Variable | Default | Notes |
| --- | --- | --- |
| `AI_API_KEY` | — | Your provider key. `FIREWORKS_API_KEY` is also accepted as an alias. |
| `AI_BASE_URL` | `https://api.openai.com/v1` | The provider's OpenAI-compatible base URL. |
| `AI_MODEL` | `gpt-4o-mini` | The model name as that provider expects it. |
| `AI_MAX_OUTPUT_TOKENS` | `8000` | Completion budget, including reasoning tokens on reasoning-capable models. |
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

## Decision layer

Generation is more than one shot. Every session is composed several ways: once by the model, and several times by the engine from the same assignment. Code then audits every candidate for the things schema validation cannot see — a movement stack, grip overload, volume that does not fit the cap, a prep that repeats the workout — and keeps the best one. That is why a generated class is not just plausible.

On top of that code audit sits an optional **decision layer**. A decision model is asked a fixed set of questions about a candidate class ("does this read as one intentional class?", "will local fatigue decide the score?", "does it add something the week is missing?") and its calibrated answers decide whether to keep the model's session or the engine's. The questions are the contract, so the same decision layer can run on Jev, on your existing chat model, or not at all.

| Variable | Default | Notes |
| --- | --- | --- |
| `AI_DECIDER` | `auto` | `auto`, `typesafe`, `llm`, or `off`. `auto` uses TypeSafe when a key is present, otherwise off. |
| `TYPESAFE_API_KEY` | — | Your TypeSafe AI key. |
| `TYPESAFE_MODEL` | `jev-latest` | The System One model to call. |
| `TYPESAFE_BASE_URL` | `https://api.typesafe.ai/v1` | Only change this for a proxy. |
| `TYPESAFE_TIMEOUT_MS` | `20000` | Per-request timeout. |
| `AI_DECIDER_THRESHOLD` | `0.6` | Confidence needed to keep a class. Raise it for stricter taste. |

The decision layer is advisory, never required. With no key and no `AI_DECIDER`, generation is unchanged: the engine still audits, ranks, and repairs its own candidates. If the decision model times out or errors, the deterministic result stands.

`AI_DECIDER=llm` answers the same questions through your configured chat provider, which is useful for comparing the two before committing to a key.


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
