# Running the GTFS API on the Raspberry Pi (for testing)

Goal: run the same GraphQL API that Lambda runs, on a Pi, so we can poll BKK's realtime feeds
much more often without paying for Lambda calls. This is for testing, not production.

Everything below is for the agent doing the deploy. Placeholders in `<angle brackets>` must be
filled in from the user's SSH config or from the user. Never print or commit the BKK key.

## What runs where

- **Mac (this repo):** source code, the timetable database, the BKK key (in `.envrc`).
- **Pi:** Docker, a copy of the timetable database, and the API container.
- The API serves `POST /graphql` on port `4000` (see `src/server.ts`).

## Prerequisites

- Pi: Docker running, at least 4 GB free disk (the database is about 1.8 GB).
- Pi: Tailscale installed, with MagicDNS enabled.
- Mac: SSH access to the Pi, and `rsync` available.
- Mac: `server/timetable.sqlite` present (the daily import output). Do not use the S3 copy here.

## Secret handling

- The BKK key is `BKK_API_KEY` in `/Users/akos/Developer/gtfs/.envrc` (line `export BKK_API_KEY="..."`).
- Read it on the Mac only, for example `set -a; . ./.envrc; set +a`, then pass it to the Pi over SSH.
- Write it to a file on the Pi with mode `600` (`umask 077`), and pass it to Docker with `--env-file`.
- Never put the key in a command line that is logged, in this README, or in git.

## Step 1: find the Pi (local first, Tailscale as fallback)

Use the local address when it answers, otherwise the Tailscale MagicDNS name:

```bash
# Mac: pick the address to use for the Pi
if ping -c 1 -W 1 <PI_LOCAL_IP> >/dev/null 2>&1; then
  PI=<PI_LOCAL_IP>
else
  PI=<PI_TAILSCALE_NAME>   # e.g. raspberrypi.<tailnet>.ts.net
fi
```

Suggested SSH aliases on the Mac (`~/.ssh/config`), so `ssh pi` works with both paths:

```
Host pi-local
  HostName <PI_LOCAL_IP>
  User <PI_USER>
Host pi-ts
  HostName <PI_TAILSCALE_NAME>
  User <PI_USER>
```

Then `ssh pi-local` if it answers, otherwise `ssh pi-ts`. The helper in `deploy/pi/pi.sh` does this check.

## Step 2: copy the code and the database to the Pi

From the Mac, in `server/`:

```bash
rsync -az --exclude node_modules --exclude .sst --exclude timetable.sqlite ./ "$PI:~/gtfs-api/"
rsync -az --progress timetable.sqlite "$PI:~/gtfs-api/data/timetable.sqlite"
```

The database is about 1.8 GB. Check free space first: `ssh "$PI" df -h ~`.

## Step 3: build the image on the Pi

On the Pi, in `~/gtfs-api`:

```bash
docker build -f Dockerfile.api -t gtfs-api:test .
```

`Dockerfile.api` does not exist yet. It should be a copy of `Dockerfile` that starts the API
instead of the import job:

```dockerfile
FROM node:22-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY src ./src
ENV SQLITE_PATH=/data/timetable.sqlite PORT=4000
EXPOSE 4000
CMD ["node", "src/server.ts"]
```

Note: `src/server.ts` and `src/realtime.ts` still read the key through SST's `Resource`. Before this
works on the Pi, the realtime fetch must read `process.env.BKK_API_KEY` instead. That code change is
not made yet. Do not start the container until it is.

## Step 4: write the env file on the Pi

```bash
ssh "$PI" 'umask 077; cat > ~/gtfs-api/api.env' <<EOF
BKK_API_KEY=<value from .envrc, passed in through this shell>
EOF
```

## Step 5: run the container

```bash
ssh "$PI" 'docker rm -f gtfs-api 2>/dev/null; docker run -d --name gtfs-api --restart unless-stopped \
  --env-file ~/gtfs-api/api.env \
  -v ~/gtfs-api/data:/data:ro \
  -p 4000:4000 gtfs-api:test'
```

The database is mounted read-only. The API only reads it.

## Step 6: check it

```bash
ssh "$PI" 'curl -s -X POST localhost:4000/graphql -H "content-type: application/json" \
  -d "{\"query\":\"{ vehiclePositions(bbox:{minLat:47.46,minLon:19.0,maxLat:47.52,maxLon:19.1}) { id } }\"}" | head -c 300'
```

Expect JSON with `vehiclePositions`. Then check the logs: `ssh "$PI" docker logs --tail 50 gtfs-api`.

## Step 7: point a client at it

- Web: `VITE_API_URL=http://<PI_LOCAL_IP>:4000/graphql` (or the Tailscale name), then run the dev server.
- iOS: the API URL is in the app code, so use a separate local build pointing at the Pi.

## Rules for the test

- Poll BKK from the Pi, not from every client. Keep one feed fetch per interval, like the server does now.
- Log every BKK response status. If BKK returns 429 or 5xx, back off and note it.
- Do not change the production Lambda setup or the production database from this test.
- Stop the test with `ssh "$PI" docker stop gtfs-api` when finished.
