# xomtracks-frontend

> Xomtracks — Angular frontend, browse cross-conversation music shares.

## What This Is
Angular SPA for Xomtracks. Authed browse UI (reuses the existing
`cognitoAuthGuard`/`cognito.service` — landing tile public, app route
gated) filtered by direction (shared-by-me / shared-with-me) and time
window (week/month/6mo/all). "Create Spotify playlist from this view" on
any filtered set. See `docs/features/xomtracks/PLAN.md`.

## Stack
- Angular, NgModules, TypeScript strict, SCSS

## Key Commands
```bash
npm start           # dev server
npm run build:prod  # production build
npm test            # unit tests
```

## Project Config
```yaml
pm_tool: github-projects
github_project_number: 2
github_project_owner: Xomware
base_branch: master
test_commands:
  - echo "no tests configured yet"
```

## Constraints
- Auth: reuse the existing shared `cognitoAuthGuard` — nothing new to build.
- Download button conditional on `platform=soundcloud` only (Spotify/Apple
  are DRM'd, listen/open only).
- By-sharer filter/group is a fast-follow, not MVP — MVP filters are
  direction + time window only.

## Lessons
