## How we pick the install tool

We pick it from your code, and the first match wins:

1. The `packageManager` field in `package.json`, such as `pnpm@9.15.0`.
2. A lockfile, in this order: `pnpm-lock.yaml`, then `bun.lock` or `bun.lockb`, then `yarn.lock`.
3. A `.yarnrc.yml` file, which means Yarn 2 or later.
4. `engines.pnpm`, `engines.bun` or `engines.yarn` in `package.json`.
5. Otherwise npm, with `package-lock.json` or `npm-shrinkwrap.json` when one is there.

This is the install command for each tool, with a lockfile, then without one:

- npm: `npm ci`, or `npm install`.
- pnpm: `corepack pnpm install --frozen-lockfile`, or `corepack pnpm install`.
- Yarn 1: `corepack yarn install --frozen-lockfile`, or `corepack yarn install`.
- Yarn 2 or later: `corepack yarn install --immutable`, or `corepack yarn install --no-immutable`.
- Bun: `bun install --frozen-lockfile`, or `bun install`.

Corepack runs pnpm and Yarn at the version your `packageManager` field names. Always ship the lockfile: without it, a deployment can install library versions you never tested.

We only install again when the install command, the Node version, `package.json` or the lockfile changes. Otherwise the console shows `dependencies are up to date (npm)`.

@[open](console)

## The build

When `package.json` has a `build` script, we run it after the install with the same tool, such as `npm run build`, on every deployment, and skip it on a plain restart. The console shows `building: npm run build`, then `build finished`. A failed build stops the deployment at stage `build`. For a different build command, set the `build` field in `serverk.json`.

## The pre-deploy command

The pre-deploy command runs once per deployment, after the install and the build and before your bot starts. It's the place for your database migrations. We run it in your code's folder with your bot's own variables and `node_modules/.bin` on the path, so a command such as `prisma migrate deploy` works as is. A plain restart skips it, and when a deployment fails, the next start of that same deployment runs it again.

The first match wins:

1. The pre-deploy command in your bot's settings.
2. The `preDeploy` field in `serverk.json`.
3. `prisma migrate deploy`, when your code has `prisma/migrations/migration_lock.toml`. Keep `prisma` in the dependencies of `package.json`.

The console shows `running the pre-deploy command: prisma migrate deploy`, then `pre-deploy command finished`. A failed command stops the deployment at stage `pre-deploy`, and your bot doesn't start.

## A command you run from the console

The pre-deploy command runs on every deployment, so keep your migrations there. For a task you run once by hand, type its command in the console instead, such as:

- `npx prisma db seed` to fill your database with its starting data.
- `node scripts/backfill.js` to run one of your own scripts once.
- `npm ls discord.js` to see which version of a library is installed.

We run it the way we run your bot: in your code's folder, as the same user your bot runs as, with your bot's variables and `node_modules/.bin` on the path. It works even while your bot is stopped or has crashed. Its output prints in the console, then `serverk: command finished`, or `serverk: command failed (exit 1)`, where the number is the command's exit code. The next deployment puts back every file your code carries, so a lasting change, such as a new library, belongs in your code.

One command runs at a time, for 10 minutes at most, and its output stops at 256 KiB. A command can't read input, so one that asks a question ends at once: add its flag that skips the questions, such as `--yes`. Before your bot's first deployment, the console answers `serverk: deploy the bot first`.

@[open](console)

## TypeScript

- With a build: `"build": "tsc"` and `"start": "node dist/index.js"`. `typescript` can stay in `devDependencies`, because we install those too. Don't add `NODE_ENV=production` to your variables: with it, npm skips `devDependencies` and the build can't find `tsc`.
- Without a build: when `index.ts` sits at the top of your code and no start file comes before it, we start it with `node index.ts`, and Node strips the types and runs the file. If your code needs a build before it runs, add a `build` script.
- With `tsx` in your dependencies, a `start` script such as `tsx src/index.ts` works, because `node_modules/.bin` is on the path.

## How we start your bot

The first match wins:

1. The start command in your bot's settings.
2. The `start` field in `serverk.json`.
3. The `worker:` or `bot:` line of a `Procfile`.
4. The `start` script in `package.json`.
5. The file named in `main` in `package.json`, with `node`.
6. `index.js`, then `src/index.js`, `bot.js`, `src/bot.js` and `index.ts`, with `node`.

We run the `start` script's command directly, not through `npm start`, so a `prestart` script doesn't run. Put that step in `build` instead, or in the pre-deploy command when it runs database migrations.

## Node version

Your bot runs on Node 24, the version in our runtime. We read `engines.node`, `.nvmrc`, `.node-version` and `.tool-versions`. When they ask for another version, we warn you on "Run your bot", print a line such as `the code asks for Node 18, this runtime is Node 24` in the console, and run your bot on Node 24.

## Bun and what else the runtime has

Bun is in the runtime too: with `bun.lock` we install with `bun install --frozen-lockfile`, and a `start` script such as `bun run src/index.ts` runs your bot with Bun. The runtime also has `python3`, `make` and `g++` for libraries that build during the install, and `ffmpeg` for audio.
