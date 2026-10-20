## One page to a running bot

Everything happens on one page, "Run your bot":

1. **Where is the code?**: pick a GitHub repository, upload your bot folder or a zip, or start from a template.
2. **What we found in the code**: we read the code and work out that it's Node.js, the library (discord.js, grammY and others), the platform, and the install and start commands. Change anything before you go on.
3. **Variables**: add the token and every variable your code reads. We suggest the names we found in the code and in `.env.example`.
4. **Choose a plan**: pick a plan and press **Pay and deploy**.

## The first deployment

After you pay, your bot's page opens and shows the deployment line by line:

- We pull the code from your repository, or unpack what you uploaded.
- We install the dependencies from `package.json` with `npm ci`, or with pnpm, Yarn or Bun when you ship their lockfile. We only reinstall when the dependencies change.
- When `package.json` has a `build` script, we run it after the install, on every deployment.
- When your bot has a pre-deploy command, such as `prisma migrate deploy`, we run it after the build and before your bot starts, on every deployment.
- We start your bot with the first of these we find: the start command in your bot's settings, `start` in `serverk.json`, the `worker:` or `bot:` line of a `Procfile`, the `start` script in `package.json`, the file named in `main`, then `index.js`, `src/index.js`, `bot.js`, `src/bot.js` and `index.ts`.

The moment these two lines show up in the console, your bot has started:

```txt
serverk: deployment dep_a1b2c3d4 ready at 3f2a9c1b7d10
serverk: bot process starting
```

@[open](overview)

## A token problem doesn't stop your bot

We start your bot even when its token has a problem, and the error shows up in the console exactly as your bot prints it. Once your bot signs in and prints a line such as `Logged in as MyBot`, its name appears on the bot card together with a link to add it to your server.

@[open](console)

## No bot yet?

We keep templates with a `/ping` or `/start` command that works right away: the [Discord template](https://github.com/serverkgg/bot-template-discord-node) and the [Telegram template](https://github.com/serverkgg/bot-template-telegram-node). Pick one on "Run your bot", and we create it as a repository in your own GitHub or copy it straight into your bot.
