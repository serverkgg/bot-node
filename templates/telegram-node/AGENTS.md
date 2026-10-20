# AGENTS.md

This repository is a Telegram bot in Node.js with grammY, deployed on Serverk (serverk.gg). Serverk runs the bot and never writes it.

## Run on Serverk

- Install: `npm ci` from `package-lock.json`. Start: `node index.js`, the `start` script in `package.json`. The image runs Node.js 24.
- `serverk.json` declares the runtime, platform, framework and variables, and may set `install`, `build`, `preDeploy` and `start`, each a one-line command. One invalid field rejects the whole file.
- `preDeploy` runs once per deployment, after install and build and before start, with the bot's variables and `node_modules/.bin` on `PATH`; database migrations go there, never in `start`. A non-zero exit fails the deployment at stage `pre-deploy`. Without one, `prisma/migrations/migration_lock.toml` gives `prisma migrate deploy`.
- Keep the `Logged in as` line: Serverk marks the bot ready when it prints it, or after 20 seconds alive.
- The bot long-polls. For webhook mode, turn on the web address in the bot's Manage page: the bot then gets `PORT`, `SERVERK_WEB_URL` and `SERVERK_WEB_HOST`, and must listen on `0.0.0.0` and `PORT`. One token runs one bot: a second copy polling the same token gets `409 Conflict`.

## Variables

- `TELEGRAM_TOKEN` (required, sensitive): the bot token from BotFather. The code reads `process.env.TELEGRAM_TOKEN`.
- Serverk delivers every variable under exactly the name it was saved with, with no prefix and no alias.
- A new variable the code reads goes into `.env.example` and the `env` list of `serverk.json`; its value goes into the bot's variables on Serverk, never into the repository.
- Never commit `.env` or a token. `.env` is in `.gitignore` and is removed from an uploaded zip.

## Deploy and debug

- With auto deploy on, the default, a push to the connected branch deploys. A variable change reaches the bot with its next deployment.
- MCP server: `https://api.serverk.gg/mcp`, scopes `customer:read customer:write customer:destructive` (the variable tools need `customer:destructive`). Tools: `customer_server_env_keys`, `customer_server_env_set`, `customer_server_deploy`, `customer_server_deployments`, `customer_server_deployment_log`, `customer_server_terminal`, `customer_server_rollback`.
- `customer_server_env_set` takes one `key` and `value`, or `entries`, a list of `{ key, value, sensitive }` that sets several variables in one call. `sensitive` defaults to true.
- Serverk's `serverk-bot` skill teaches the whole workflow; its repository is https://github.com/serverkgg/serverk-skills. Guides: https://serverk.gg/bots/bot-node/guides
