# Iris server

Holds the Claude API key and Iris's instructions for Eye Lab, so the app ships with no key.
Deployed on Vercel as `eye-lab-iris` → https://eye-lab-iris.vercel.app/api/iris

- `lib/iris.ts`: model, system prompt (app guide, how to read the data, research brief) and tool definitions.
  Tool names and game keys must match `web/src/lib/iris.ts` and `web/src/app/catalog.ts` (the old Godot
  client in `eye_lab/autoload/iris.gd` knows only the first five tools).
- `api/iris.ts`: `POST` takes `{messages, context}` with header `x-anthropic-key` (the visitor's own key) or
  `x-eyelab-key` (old desktop builds), calls Claude, returns `{content, stop_reason}`. `context` is the app's
  short "Right now" block (date, player, screen, filter, settings); it is added as a second system block.

Environment variables (Vercel, Production): `ANTHROPIC_API_KEY`, `EYELAB_APP_KEY` (must equal `APP_KEY` in `eye_lab/autoload/iris.gd`).

Deploy changes: `vercel deploy --prod`
