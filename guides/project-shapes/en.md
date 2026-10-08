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

We run the `start` script's command directly, not through `npm start`, so a `prestart` script doesn't run. Put that step in `build` instead.

## Node version

Your bot runs on Node 24, the version in our runtime. We read `engines.node`, `.nvmrc`, `.node-version` and `.tool-versions`. When they ask for another version, we warn you on "Run your bot", print a line such as `the code asks for Node 18, this runtime is Node 24` in the console, and run your bot on Node 24.

## Bun and what else the runtime has

Bun is in the runtime too: with `bun.lock` we install with `bun install --frozen-lockfile`, and a `start` script such as `bun run src/index.ts` runs your bot with Bun. The runtime also has `python3`, `make` and `g++` for libraries that build during the install, and `ffmpeg` for audio.
