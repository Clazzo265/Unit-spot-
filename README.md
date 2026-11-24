# UNIT SPOT

Shared money. Clear records. No confusion. A React/Vite app for tracking MWK group contributions, expenses, payment proof, and balances for shared houses, families, chilimba groups, churches, and teams.

## Local development

```bash
npm install --legacy-peer-deps --no-audit --no-fund
npm run dev
```

The dev server listens on `http://localhost:3000` and binds to `0.0.0.0` for container previews.

`--legacy-peer-deps` is currently required: `esbuild` is pinned to `^0.25.0` while Vite 8 expects `^0.27 || ^0.28`. Once that pin is updated, a plain `npm install` will work.

Other scripts:

```bash
npm run lint   # tsc --noEmit
npm run build  # production build into dist/
```

The six test files under `src/utils` use Node's built-in test runner. There is no `test` script yet; run them with:

```bash
npx tsx --test src/utils/*.test.ts
```

## Firebase configuration

`src/firebase/config.ts` reads `firebase-applet-config.json`, which currently points at the shared development Firebase project and a named Firestore database. To use your own project, replace those values (or make them environment-driven) before deploying.

Email/password and Google sign-in must be enabled in Firebase Authentication, and `email_verified` is enforced by `firestore.rules` and `storage.rules`.

## Deploying to GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` builds and publishes the site automatically.

1. In the repository settings, open **Pages → Build and deployment → Source** and select **GitHub Actions**.
2. Push to `main` or `arena/7fd7d37a-unit-spot`, or run the **Deploy to GitHub Pages** workflow manually.
3. The site will be available at `https://<owner>.github.io/Unit-spot-/`.

The workflow sets `VITE_BASE_PATH=/Unit-spot-/`, which `vite.config.ts` uses for asset URLs. Local development keeps the default `/` base.

### Before sign-in works on GitHub Pages

- Add `<owner>.github.io` to **Authentication → Settings → Authorized domains** in the Firebase console. If it is missing, sign-in fails with `auth/unauthorized-domain` (older builds showed the misleading "Please allow popups" message for every error).
- Add the same domain to the OAuth redirect domains for Google sign-in. Firebase normally manages this automatically once the domain is authorized.
- Enable **Google** under **Authentication → Sign-in method** if it is not already enabled.
- If the browser blocks the popup, allow popups for the site; the error banner now distinguishes that case from domain/OAuth misconfiguration.
- Deploy `firestore.rules` and `storage.rules` to the Firebase project referenced by `firebase-applet-config.json`. There is currently no `firebase.json` or deployment script for rules, so the repository copies and the live rules must be kept in sync manually.

## Deployment notes

- Invite links include the Vite base path, so shared links point to `/Unit-spot-/?join=...` instead of the domain root (which returns GitHub's "There isn't a GitHub Pages site here" 404).
- `public/404.html` redirects unknown paths back to `index.html` while preserving `?join=` invite codes and hashes.
- No secrets are needed for the Pages workflow itself; it uses the built-in `GITHUB_TOKEN` via `actions/deploy-pages`.
- The `.env.example` file documents Gemini/AI Studio variables that the app does not currently use.
