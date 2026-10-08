## Find your line

When your bot stops on one of the lines below, its page names the cause and what to do. Find the line in the console, then read its section here. Each line is copied as the library prints it, and its start is enough to match.

@[open](console)

## The token is invalid

- discord.js: `Error [TokenInvalid]: An invalid token was provided.`
- grammY: `GrammyError: Call to 'getMe' failed! (401: Unauthorized)`, or `GrammyError: Call to 'deleteWebhook' failed! (404: Not Found)`.

Copy the token again from the Developer Portal or BotFather, update it in your variables, then redeploy.

## Privileged intents are off

- discord.js: `Error: Used disallowed intents`, or `Error [DisallowedIntents]: Privileged intent provided is not enabled or whitelisted.`

Turn on the intents your code asks for on the Bot page of the Developer Portal, then start your bot again. The guide "Your Discord bot's token, intents and permissions" shows the switch each intent needs.

## Another bot is using the token

- grammY: `GrammyError: Call to 'getUpdates' failed! (409: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running)`

One token runs only one bot at a time. Stop the other copy, such as one on your computer, or send `/revoke` to BotFather for a new token, update it in your variables, then redeploy.

## A library is missing

- `Error: Cannot find module 'discord.js'`
- `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'telegraf' imported from /home/container/index.js`

Add the library to `dependencies` in `package.json`, push the lockfile with it, then redeploy. Running `npm install discord.js` on your computer updates both files. If the missing name starts with `./`, it's one of your own files: check its path and its letter case, because file names here are case-sensitive.

## A library couldn't be built

- `gyp ERR! stack Error: not found: make`

The problem is on our side. [Contact us](/dashboard/support) and we'll add the tools the library needs.

## ffmpeg is missing

- `Error: spawn ffmpeg ENOENT`

The problem is on our side. [Contact us](/dashboard/support) and we'll add ffmpeg to the runtime.

## Your bot hit a rate limit

- grammY: `GrammyError: Call to 'sendMessage' failed! (429: Too Many Requests: retry after 5)`
- Or the line `error code: 1015`

Give it a few minutes before you start it again, and check the code that sends requests in a loop.

## Not enough RAM while running

No library prints a line for this. Your bot stops at once when it goes past your plan's RAM, with exit code `137`, and its page shows "Not enough RAM". Upgrade the plan for more RAM, or cut down what your bot keeps in memory.

## Not enough RAM during the install or the build

- `serverk: install failed: it ran out of memory and was stopped`
- Then `serverk: deployment dep_a1b2c3d4 failed: install: out-of-memory`

You see `build` in place of `install` when the build ran out of RAM. Upgrade the plan for more RAM, then redeploy.

> [!note] Your line isn't here? The first red line in the console still says what went wrong, and the guide "Read the console and work out what happened" shows how to read it.
