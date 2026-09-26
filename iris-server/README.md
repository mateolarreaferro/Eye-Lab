# Iris server

Holds the Claude API key and Iris's instructions for Eye Lab, so the app ships with no key.
Deployed on Vercel as `eye-lab-iris` → https://eye-lab-iris.vercel.app/api/iris

- `lib/iris.ts`: model, system prompt (app guide + research brief) and tool definitions.
  Tool names/game keys must match `eye_lab/autoload/iris.gd` and `eye_lab/main.gd`.
- `api/iris.ts`: `POST` takes `{messages}` with header `x-eyelab-key`, calls Claude, returns `{content, stop_reason}`.

Environment variables (Vercel, Production): `ANTHROPIC_API_KEY`, `EYELAB_APP_KEY` (must equal `APP_KEY` in `eye_lab/autoload/iris.gd`).

Deploy changes: `vercel deploy --prod`
