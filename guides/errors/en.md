## Find your line

When your bot stops on one of the lines below, its page names the cause and what to do. Find the line in the console, then read its section here. Each line is copied as the library prints it, and its start is enough to match.

@[open](console)

## The token is invalid {#token-invalid}

- discord.js: `Error [TokenInvalid]: An invalid token was provided.`
- grammY: `GrammyError: Call to 'getMe' failed! (401: Unauthorized)`, or `GrammyError: Call to 'deleteWebhook' failed! (404: Not Found)`.

Copy the token again from the Developer Portal or BotFather, update it in your variables, then redeploy.

## Privileged intents are off {#intents-disallowed}

- discord.js: `Error: Used disallowed intents`, or `Error [DisallowedIntents]: Privileged intent provided is not enabled or whitelisted.`

Turn on the intents your code asks for on the Bot page of the Developer Portal, then start your bot again. The guide "Your Discord bot's token, intents and permissions" shows the switch each intent needs.

## Another bot is using the token {#token-in-use}

- grammY: `GrammyError: Call to 'getUpdates' failed! (409: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running)`

One token runs only one bot at a time. Stop the other copy, such as one on your computer, or send `/revoke` to BotFather for a new token, update it in your variables, then redeploy.

## A webhook is set on the token {#webhook-active}

- `Conflict: can't use getUpdates method while webhook is active; use deleteWebhook to delete the webhook first`

Telegram sends this text, inside the line your library prints, when your bot pulls messages by polling while its token still has a webhook set, from an old host or from when the web address was on. Pick one:

- Move your code to the webhook and turn on the web address, as the guide "Your bot's web address and ports" shows.
- Or delete the webhook once: open `https://api.telegram.org/botTOKEN/deleteWebhook` in your browser with your token in place of `TOKEN`, then start your bot again.

## A library is missing {#missing-dependency}

- `Error: Cannot find module 'discord.js'`
- `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'telegraf' imported from /home/container/index.js`

Add the library to `dependencies` in `package.json`, push the lockfile with it, then redeploy. Running `npm install discord.js` on your computer updates both files. If the missing name starts with `./`, it's one of your own files: check its path and its letter case, because file names here are case-sensitive.

## A library couldn't be built {#build-tools}

- `gyp ERR! stack Error: not found: make`

The problem is on our side. [Contact us](/dashboard/support) and we'll add the tools the library needs.

## ffmpeg is missing {#ffmpeg-missing}

- `Error: spawn ffmpeg ENOENT`

The problem is on our side. [Contact us](/dashboard/support) and we'll add ffmpeg to the runtime.

## Your bot hit a rate limit {#rate-limited}

- grammY: `GrammyError: Call to 'sendMessage' failed! (429: Too Many Requests: retry after 5)`
- Or the line `error code: 1015`

Give it a few minutes before you start it again, and check the code that sends requests in a loop.

## Your bot isn't listening on its web address {#web-not-listening}

The web address is on, but nothing answered on the port in `PORT`, so your bot's page warns you and the address shows "This bot isn't answering right now". Make your bot listen on `0.0.0.0` and `Number(process.env.PORT)`, not on `localhost` or `127.0.0.1` and not on a fixed number such as `3000`, then redeploy. The guide "Your bot's web address and ports" shows how for each library. If your bot doesn't need the web address, turn it off in **Manage**.

## Your bot opens the same port twice {#port-busy}

- `Error: listen EADDRINUSE: address already in use 0.0.0.0:8080`

Nothing else uses your bot's ports, so this line means your code opens the same port twice, such as an Express server for your pages and Telegraf's webhook server both on `PORT`, or an old keep-alive server beside them. Open one server on `PORT` and add every route to it, then redeploy.

## Your bot stopped with exit code `137` {#oom-kill}

Your plan's RAM ran out while your bot was running. Nothing is printed: your bot stops at once with exit code `137`, and its page shows "Not enough RAM". Upgrade the plan for more RAM, or cut down what your bot keeps in memory.

## Not enough RAM to install, build or run {#out-of-memory}

- `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
- `serverk: install failed: it ran out of memory and was stopped`
- Then `serverk: deployment dep_a1b2c3d4 failed: install: out-of-memory`

Node prints the first line when its memory fills up while your bot runs. The other two mean the install ran out of RAM, and you see `build` in place of `install` when the build did. Upgrade the plan for more RAM, then redeploy.

> [!note] Your line isn't here? The first red line in the console still says what went wrong, and the guide "Read the console and work out what happened" shows how to read it.
