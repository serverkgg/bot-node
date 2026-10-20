## What to bring

- Your bot's code: a GitHub repository, its folder or a zip.
- `package.json` with its lockfile, such as `package-lock.json`.
- The names and values of your variables, the token included.
- The data files your bot wrote, such as `bot.sqlite` or `data.json`.

## Stop the old copy first

On Telegram, one token runs only one bot at a time: the second copy gets `409 Conflict`. On Discord, both copies connect and both answer, so every reply comes twice. Stop your bot on the old host before the first deployment here, or give it a new token.

## What you don't need here

- **Keep-alive**: a small web server such as `keep_alive.js` or an Express route, visited by a service such as UptimeRobot. We keep your bot running without it, and nothing outside reaches your bot unless you turn on its web address or a port.
- **pm2, nodemon and forever**: start your bot directly, such as `node index.js`. We restart it ourselves after a crash, and we only see the crash when your bot's own process stops.
- **Telegram webhooks**: polling is enough, such as `bot.start()` in grammY, as our template does. To use a webhook, turn on the web address, as the guide "Your bot's web address and ports" shows.

## Move your variables

Put every value from your `.env` file, your Replit Secrets or your old host's variables into your bot's variables under the same name, and mark the secret ones **Sensitive**. Have a `.env` file? Paste all of it into the variables box at once.

If your `start` script runs `node --env-file=.env`, remove that flag, because the `.env` file doesn't come with the code.

@[open](overview)

## What we read from your code

We read `package.json`, the lockfile and a `Procfile`, never your old host's own settings:

- **Heroku** and **Railway**: we run the `worker:` or `bot:` line of your `Procfile`. A `web:` line isn't read. Neither is a `release:` line or Railway's **Pre-deploy Command**, so put that command in the pre-deploy command in your bot's settings or in the `preDeploy` field of `serverk.json`.
- **Replit**: the `.replit` file isn't read.
- **Discloud**: `discloud.config` isn't read, so if we don't find the `MAIN` file it names, put that file in your `start` script.
- **A Pterodactyl host**: the startup command in its panel isn't read, and you don't need a `git pull` at start. Link GitHub and turn on **Deploy on every push** instead.
- **A VPS**: you don't need systemd or screen, because we start your bot and restart it ourselves.

When we find no way to start your bot, add a `start` script to `package.json`, or a `serverk.json` at the top of your code:

```json
{
  "start": "node src/main.js"
}
```

`serverk.json` also takes `install`, `build` and `preDeploy`, each a command on one line. One invalid field drops the whole file.

The guide "How we install and start a Node project" lists the files we look for, in order.

## Bring your data

After the first deployment, upload your data files in the **Files** tab, to the path your code reads. Keep them out of your repository and out of every upload, so later deployments leave them as they are.

@[open](files)
