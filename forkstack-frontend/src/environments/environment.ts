/**
 * Central config for the frontend. `apiBase` is the single source of truth for
 * the backend URL -- every service builds its endpoints from it.
 *
 * There is currently one backend (the deployed API Gateway); the local dev
 * server (ng serve) talks to it too, since http://localhost:4200 is in the
 * backend's ALLOWED_ORIGINS. If a separate staging/prod backend is ever added,
 * introduce environment.prod.ts and a fileReplacements entry in angular.json.
 */
export const environment = {
  production: false,
  apiBase: 'https://e6q9keyixh.execute-api.us-east-1.amazonaws.com/prod',
};
