// ─── STAGING ENVIRONMENT SETUP ───────────────────────────────────────────────
//
// To wire up a Vercel staging environment connected to a GitHub staging branch:
//
// 1. Create the staging branch locally and push it:
//      git checkout -b staging
//      git push origin staging
//
// 2. In Vercel dashboard → your project → Settings → Git:
//      Under "Ignored Build Step" or "Branch Deployments", ensure the staging
//      branch is not ignored. Vercel auto-deploys all branches by default.
//      Each push to `staging` will get its own preview URL.
//
// 3. In Vercel dashboard → your project → Settings → Environment Variables:
//      Add these variables scoped to the Preview environment (or specifically
//      to the `staging` branch if Vercel allows branch-level scoping):
//        REACT_APP_ENV          = staging
//        REACT_APP_API_URL      = https://api-staging.aisalesscales.com
//      (Deploy your Express backend to a separate service — e.g. Railway or
//       Render — for staging, and point REACT_APP_API_URL at it.)
//
// 4. For production, set in the Production environment:
//        REACT_APP_ENV          = production
//        REACT_APP_API_URL      = https://api.aisalesscales.com
//
// 5. For local development, leave both unset — the fallback is localhost:3001.
//
// ─────────────────────────────────────────────────────────────────────────────

const STAGING_API_FALLBACK = 'https://api-staging.aisalesscales.com';
const PRODUCTION_API_FALLBACK = 'https://api.aisalesscales.com';

export const API_BASE =
  process.env.REACT_APP_ENV === 'staging'
    ? (process.env.REACT_APP_API_URL || STAGING_API_FALLBACK)
    : process.env.REACT_APP_ENV === 'production'
    ? (process.env.REACT_APP_API_URL || PRODUCTION_API_FALLBACK)
    : process.env.REACT_APP_API_URL || 'http://localhost:3001';
