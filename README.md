# Terminal

Lightweight container host (`terminal`) that runs pluggable module containers (FastAPI) and tracks them in a local SQLite DB.

## Overview

- `terminal/` – Node.js + Fastify backend, HTML UI at `/`, SQLite DB.
- `modules/example-module/backend` – FastAPI module **sub-repo** (git submodule).
- `docker-compose.yml` – runs `terminal` and all modules.
- SQLite is stored in a **named Docker volume** `terminal-data`.

## Running

```bash
# from repo root
docker compose up -d

# UI
http://localhost:3000/

# API
http://localhost:3000/health
http://localhost:3000/api/modules

# example module
http://localhost:8000/health
http://localhost:8000/module/metadata
```

## Working with modules

Each module backend lives in its **own Git repo**, mounted into this repo as a **git submodule**.

- Example: `modules/example-module/backend` → `JoshuaHoare/terminal-example-module`.
- Docker builds the submodule path directly: `build: ./modules/example-module/backend`.

### Add or edit a module

1. **Edit code** inside the module repo path, e.g.

   ```bash
   cd modules/example-module/backend
   # edit files...
   git status
   git add .
   git commit -m "..."
   git push
   ```

2. **Update submodule pointer in Terminal**:

   ```bash
   cd ../../..   # back to Terminal repo root
   git status
   git add modules/example-module/backend
   git commit -m "Bump example-module submodule"
   git push
   ```

3. **Rebuild + run**:

   ```bash
   docker compose build
   docker compose up -d
   ```

### Configure module in UI

1. Open `http://localhost:3000/`.
2. Use the **Add / update module** form:
   - `id`: module ID (e.g. `example-module`).
   - `serviceUrl`: internal URL (e.g. `http://example-module:8000`).
   - `githubUrl`: GitHub repo URL (e.g. `https://github.com/JoshuaHoare/terminal-example-module`).
3. Save. The module appears in the list; clicking the row shows details in a popup.

## Dev + push cycle (read this before pushing)

**When you change only Terminal (Node/HTML/Docker/etc.):**

```bash
# in Terminal repo root
git status
git add .
git commit -m "..."
git push
```

**When you change a module backend:**

1. Inside the module sub-repo:

   ```bash
   cd modules/<module>/backend
   git add .
   git commit -m "..."
   git push
   ```

2. In Terminal repo root, record new submodule commit:

   ```bash
   cd ../../../
   git add modules/<module>/backend
   git commit -m "Bump <module> submodule"
   git push
   ```

## Data storage

- SQLite file is at `/app/data/terminal.db` inside the `terminal` container.
- Persisted in Docker named volume: `terminal-data`.
- Safe from deleting the working folder; only removed if you delete the Docker volume.
