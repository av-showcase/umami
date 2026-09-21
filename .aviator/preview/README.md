# Preview environment

Aviator Verify can run this branch as a live app on a public URL, so the verify
agent can drive it in a real browser instead of only reading the diff.

Three pieces, in three different places:

| Piece | Where it lives |
| --- | --- |
| The image (a pre-warmed box with the build and the demo database baked in) | Built by e2b. `Dockerfile` here is the reviewable copy, **not** the source of truth. |
| The setup script (rebuilds what the branch changed and starts the app) | `.aviator/scripts/preview-setup.sh` in this repo |
| The config (which image, which port, which script) | Aviator's database, edited in the UI |

## Config

Paste this at **Verify → Settings → Verify**, with this repo selected:

```yaml
verify:
  preview:
    - name: default
      image: umami-preview # display name of the custom template
      port: 3000
      setup: .aviator/scripts/preview-setup.sh
      secrets:
        - UMAMI_ADMIN_USERNAME
        - UMAMI_ADMIN_PASSWORD
```

`secrets:` names account secrets (Settings → Secrets); their values are injected
into the setup script as environment variables of the same name, and the verify
skill refers to them as `{{ secrets.UMAMI_ADMIN_USERNAME }}` /
`{{ secrets.UMAMI_ADMIN_PASSWORD }}`. They become the admin login: the setup
script rewrites the user seeded by `prisma/migrations/01_init` to these values,
so nothing in this repo holds a credential and the default `admin` / `umami`
does not survive.

Two things about how keys resolve, both of which the script defends against:

- A key that does not exist is **not** an error — the resolver looks keys up
  with an `IN` query and omits what it cannot find — so the script checks for
  both itself and fails with the missing names rather than booting a umami
  nobody can log into.
- The `secrets:` list matches keys **case-sensitively** while the
  `{{ secrets.* }}` placeholders resolve **case-insensitively**, so a secret
  created in the other case would reach the skill but not the script. The script
  accepts the lowercase spelling as a fallback.

`image:` is the *display name* you gave the custom template, not the e2b alias.
Saving validates it with the same resolver the launch uses, so a green save
proves the image wiring works. The verify skill is picked up automatically from
`.aviator/verify/skills/default.md` (matching `name: default`).

## Building the image

**Verify → Settings → Sandbox → Custom templates → Add → From Dockerfile**, then
paste the contents of `Dockerfile` in this directory.

Aviator appends two steps of its own before building at 4 CPU / 4 GB:

```
npm install -g @anthropic-ai/claude-code   # needs npm in the image
apt install git git-lfs
```

Expect roughly **20–30 minutes** and a large image — it bakes `node_modules`,
the Next.js production build, the tracker/recorder bundles, the GeoLite2
database, and a PostgreSQL cluster migrated and seeded with 30 days of demo
analytics.

> **Check for an alias collision before you build.** Template aliases are derived
> from the database row id (`account-<account>-id-<row>`). A new row that lands
> on an id already used by an older row rebuilds *that* template in place,
> silently replacing another repo's image. If two rows share an alias, delete and
> re-add so the new row gets a fresh id.

Rebuild the template when the base image, the Node or pnpm version, the set of
baked build steps, or the seeded schema changes. Routine dependency bumps do not
need one — the setup script reinstalls when the lockfile moves, it is just
slower that run.

## Why it is fast

The launch cleans the checkout with `git clean -fd` — **no `-x`** — so gitignored
files survive. That is the whole caching mechanism, and `.gitignore` is the list
of what may be cached:

| Cache | Why it survives |
| --- | --- |
| `node_modules/` | `node_modules` is gitignored |
| `.next/` (incl. its build cache) | `/.next` is gitignored |
| `src/generated/prisma` | `/src/generated` is gitignored |
| `packages/*/dist` | `/packages/*/dist` is gitignored |
| `public/script.js`, `public/recorder.js`, `public/openapi.json` | each is gitignored |
| `geo/GeoLite2-City.mmdb` | `/geo` is gitignored |
| The PostgreSQL cluster and its demo data | lives at `/var/lib/postgresql`, outside `/code`, so git never sees it |

Only `pnpm install` and the Next.js build are gated on a path diff against
`/preview-image-sha`, the commit the image's caches were built from. The prisma
client, the OpenAPI spec and the generated API client are cheap and are redone
every launch, because a stale one fails at request time rather than at build
time.

The seeded analytics would age with the image, so the setup script shifts every
seeded timestamp forward by whole days at each launch — umami's default range is
the last 24 hours, and an unshifted week-old image opens on empty charts that
read as "this branch broke analytics".

## Testing the script without a full round-trip

```bash
docker build -f .aviator/preview/Dockerfile -t umami-preview:test .
./.aviator/scripts/preview-test-local.sh
```

That script exists because a plain `docker run` does **not** behave like an e2b
sandbox — it simulates the two differences that have already cost a production
debug each (systemd's `pg_ctlcluster` redirect, and the missing snakeoil
certificate). Read its header before adding a third.

It confirms diagnoses and fixes. It will not find timing bugs — a laptop is fast
enough to hide the startup races that a cold sandbox exposes.

## First-run diagnostic

This line in the launch output tells you whether the caching design is working
at all:

```
[0s]   build cache baked at 2228fe25c9ab, branch head is a1b2c3d
```

Present means the image booted and its caches survived. Missing means the
git-fetch fast path did not match, Aviator re-cloned, and every build ran cold —
the preview still works, it is just slow, and the database will be empty because
the seeded cluster came from the image.

## Known constraints

- **4 GB of RAM** for both the template build and the running sandbox. The
  Next.js build runs with `--max-old-space-size=3584`; if a future dependency
  pushes it past that, the failure is a bare `Killed` from the OOM killer.
- **1800s** for the setup script. A cold, cache-missing boot rebuilds all of
  umami and can approach it.
- **No live traffic.** `/script.js` is served but no external site loads it, so
  Realtime is permanently empty and every number on screen comes from the seed.
- **PostgreSQL only.** ClickHouse, Redis and Kafka are unset, so the
  clustered/cloud code paths are not exercised.
