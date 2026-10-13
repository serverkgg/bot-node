## What your bot gets

Your bot can have an HTTPS web address and two extra ports. All three stay off until you turn them on in **Manage**, and only a bot on a paid plan can turn them on, not one on a free trial.

- The web address: `https://name.srvk.gg`, where `name` is your bot's custom address, with a certificate we issue and renew for you. Telegram webhooks, Discord interactions and your bot's own pages arrive here.
- Port 1 and Port 2: each takes TCP and UDP on the same number, with no certificate.

## Turn on the web address

1. Open **Manage** and turn on the web address. We restart your bot so it gets the address.
2. Make your bot listen on `0.0.0.0`, meaning every address and not `localhost`, on the port in `PORT`. We send every request for your address to that port.
3. Check the console: before your bot starts, it shows `serverk: web address https://name.srvk.gg on port 8080`.

The address answers once its certificate is active. **Manage** shows the certificate's state and tells you when your bot isn't listening. We wait up to 60 seconds for your bot to answer each request, and WebSockets go through too.

@[open](console)

## The variables

While the web address is on, your bot gets:

- `PORT`: the port your bot listens on, such as `8080`. It replaces any `PORT` you added to your variables.
- `SERVERK_WEB_URL`: the full address, such as `https://name.srvk.gg`, with no `/` at the end.
- `SERVERK_WEB_HOST`: the domain alone, such as `name.srvk.gg`.

Always read these from `process.env` and never write them into your code, because they change when you change the custom address.

## Telegram webhooks

With a webhook, Telegram sends messages straight to your bot's address, instead of your bot pulling them by polling.

In Telegraf, `bot.launch` sets the webhook to your address and listens on `PORT` by itself:

```js
bot.launch({
	webhook: {
		domain: process.env.SERVERK_WEB_HOST,
		port: Number(process.env.PORT),
	},
});
```

In grammY, take the requests with Express and set the webhook on every start:

```js
import express from "express";
import { Bot, webhookCallback } from "grammy";

const bot = new Bot(process.env.TELEGRAM_TOKEN);
const app = express();

app.use(express.json());
app.post("/webhook", webhookCallback(bot, "express"));
app.listen(Number(process.env.PORT), "0.0.0.0");

await bot.api.setWebhook(`${process.env.SERVERK_WEB_URL}/webhook`);
```

Remove `bot.start()`, because polling and a webhook can't share one token. Add `express` to `dependencies` in `package.json`.

## Discord interactions over HTTP

When you set an **Interactions Endpoint URL** for your app, Discord sends slash commands and button clicks to your bot's address instead of over the gateway:

1. Add `DISCORD_PUBLIC_KEY` to your variables, set to the **Public Key** on your app's **General Information** page in the Developer Portal.
2. Take the requests on the `/interactions` path and check each one's signature with the `discord-interactions` library, as in the example below.
3. Deploy your bot, then enter the value of `SERVERK_WEB_URL` followed by `/interactions` in **Interactions Endpoint URL**, such as `https://name.srvk.gg/interactions`, and press **Save Changes**.

```js
import { InteractionResponseType, verifyKeyMiddleware } from "discord-interactions";
import express from "express";

const app = express();

app.post("/interactions", verifyKeyMiddleware(process.env.DISCORD_PUBLIC_KEY), (req, res) => {
	res.send({
		type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		data: { content: "Hello from Serverk" },
	});
});

app.listen(Number(process.env.PORT), "0.0.0.0");
```

Add `discord-interactions` and `express` to `dependencies`, and don't put `express.json()` before `verifyKeyMiddleware`, because the signature covers the request exactly as it arrived. When you save, Discord sends a PING and keeps the URL only if your bot answers PONG with status 200 within 3 seconds; `verifyKeyMiddleware` answers it for you. After that, every interaction needs an answer within 3 seconds too.

> [!warning] Once the URL is saved, interactions stop arriving over the gateway, so `interactionCreate` in discord.js no longer fires. To get them back, delete the URL from the field and save.

## Your bot's own pages

To serve a page or a dashboard from your bot, open one Express server on `PORT`:

```js
import express from "express";

const app = express();

app.get("/health", (req, res) => {
	res.send("ok");
});

app.listen(Number(process.env.PORT), "0.0.0.0");
```

Your bot listens on one web port, so if it also takes a webhook or Discord interactions, add their routes to the same server and don't open a second one on `PORT`.

## Port 1 and Port 2

Turn on the port you need in **Manage**, and its number reaches your bot in `SERVERK_PORT_1` or `SERVERK_PORT_2`. Make your bot listen on `0.0.0.0` on that same number, not on `PORT`; the port takes TCP and UDP on that number. Others reach your bot at `name.srvk.gg` with the number, as your bot's page shows it.

The number shows in the console before your bot starts, such as `serverk: port 1 on 29004`, or `serverk: port 1 at name.srvk.gg:29004` while the web address is on. Always read it from the variable and never write it into your code.

These two ports carry no certificate, so what goes through them isn't encrypted unless your bot encrypts it itself. For web pages and webhooks, use the web address.

## When you change the custom address

When you change the custom address in **Manage**, we restart your bot so it gets the new `SERVERK_WEB_URL`, and we issue a certificate for the new address. A Telegram webhook updates itself when your code sets it on every start, as in the examples above. On Discord, update the **Interactions Endpoint URL** in the Developer Portal yourself.

## What you can't serve

Serve only what belongs to your bot on its address and its ports. Anything that breaks the [Terms of Service](/legal/terms) is forbidden, including:

- Pages that pretend to be another service, or collect passwords and sign-in details.
- Proxies, VPNs and anything that relays other people's connections.
- Hosting files or sites that have nothing to do with your bot.

We turn off the web address and the ports of any bot that does.
