# xomtracks-frontend

Angular frontend for **Xomtracks** — the authed browse UI for the
cross-conversation music-share feed. Pulls every Spotify / SoundCloud /
Apple Music link your group drops in iMessage into one cover-art-forward
feed, filterable by direction (shared with me / by me) and time window
(week / month / 6mo / all).

Deploys to `xomtracks.xomware.com`. See `docs/features/xomtracks-v2/` in the
docs repo for the full spec.

## Stack

- Angular 18 (NgModules), TypeScript strict, SCSS
- Auth via the shared `xomware_users` Cognito pool + Google Hosted UI
  (SSO carry-over from any Xomware app), mirroring xomforms-frontend.

## Setup

```bash
npm install --legacy-peer-deps
npm start            # dev server on 127.0.0.1:4200
npm run build:prod   # production bundle -> dist/xomtracks-frontend/browser
```

For local sign-in against the live Hosted UI, fill the two Cognito ids in
`src/environments/environment.development.ts` from
`aws ssm get-parameter --name /xomware/shared/cognito/...`.

## Deploy

`.github/workflows/deploy-frontend.yml` builds and syncs to
`s3://xomtracks.xomware.com` on push to `master`, injecting the Cognito
pool/client/domain from SSM at build time (nothing hardcoded), then
invalidates CloudFront. Requires repo secrets `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY`.

## Brand

RED `#ff3750` + CYAN `#66eefb`, sampled from the app icon. Optimized
banner/icon live in `src/assets/img/` (the large `*-source.png` originals
are preserved in-repo but excluded from the build bundle via `angular.json`).
