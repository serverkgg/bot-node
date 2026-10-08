# بوت تيليقرام (grammY)

قالب بوت تيليقرام بسيط بـ Node.js: أمر `/start` يرحّب بك، ويرد على أي رسالة بنصها. أنشئ منه ريبو خاصًا بك وابنِ عليه.

A minimal Telegram bot in Node.js: a `/start` command that greets you and echoes every message back. Make it your own repository and build on top.

## شغّله على Serverk

[انشره على Serverk](https://serverk.gg/bots/create?template=telegram-node)

1. افتح الرابط أعلاه، أو اضغط **Use this template** في GitHub ثم اختر ريبوك الجديد من «شغّل بوتك».
2. أضف التوكن إلى المتغيرات باسم `TELEGRAM_TOKEN` واتركه حساسًا.
3. اضغط «ادفع وانشر». نثبّت المكتبات بالأمر `npm ci` من `package-lock.json`، ونشغّل البوت بالأمر `node index.js` من سكربت `start` في `package.json`، على Node.js 24. وكل push على `main` ينشر بوتك من جديد.

| المتغير | مطلوب | القيمة |
| --- | --- | --- |
| `TELEGRAM_TOKEN` | نعم | توكن البوت من BotFather |

- يصل كل متغير إلى بوتك بالاسم الذي حفظته به تمامًا، دون بادئة أو أي تغيير، ويقرؤه الكود من `process.env.TELEGRAM_TOKEN`.
- لا يصل ملف `.env` إلى Serverk أبدًا: يستبعده `.gitignore` من الريبو، ونحذفه من أي zip ترفعه ونقترح أسماء متغيراته دون قيمها. يحمل `.env.example` الأسماء فقط.
- يستقبل البوت الرسائل بطريقة polling، لأن البوت على Serverk لا يفتح أي منفذ. والتوكن الواحد يشغّل بوتًا واحدًا، فأوقف أي نسخة أخرى تعمل بالتوكن نفسه قبل النشر.

الشروحات: [شغّل بوتك أول مرة](https://serverk.gg/bots/bot-node/guides/getting-started)، [أضف التوكن والمتغيرات](https://serverk.gg/bots/bot-node/guides/environment-variables)، [أين تجد توكن بوت تيليقرام](https://serverk.gg/bots/bot-node/guides/telegram-token).

## Run it on Serverk

[Deploy it on Serverk](https://serverk.gg/bots/create?template=telegram-node)

1. Open the link above, or press **Use this template** on GitHub and pick your new repository on **Run your bot**.
2. Add the token to your variables as `TELEGRAM_TOKEN`, marked sensitive.
3. Press **Pay and deploy**. We install the dependencies with `npm ci` from `package-lock.json` and start the bot with `node index.js`, the `start` script in `package.json`, on Node.js 24. Every push to `main` deploys your bot again.

| Variable | Required | Value |
| --- | --- | --- |
| `TELEGRAM_TOKEN` | Yes | The bot token from BotFather |

- Every variable reaches your bot under exactly the name you saved it with, with no prefix and no renaming. The code reads it from `process.env.TELEGRAM_TOKEN`.
- A `.env` file never reaches Serverk: `.gitignore` keeps it out of the repository, and we remove it from any zip you upload and suggest its variable names without the values. `.env.example` holds the names only.
- The bot receives messages by long polling, because a bot on Serverk opens no port. One token runs one bot, so stop any other copy that uses the same token before you deploy.

Guides: [Run your bot for the first time](https://serverk.gg/bots/bot-node/guides/getting-started), [Add the token and your variables](https://serverk.gg/bots/bot-node/guides/environment-variables), [Where to find your Telegram bot token](https://serverk.gg/bots/bot-node/guides/telegram-token).

## مع أداة ذكاء اصطناعي / With an AI tool

يشرح ملف `AGENTS.md` في هذا الريبو ما سبق لأداة الذكاء الاصطناعي التي تكتب بها بوتك. وتعلّمها `use-serverk` من Serverk طريقة النشر كاملة، ونذكر ريبو `use-serverk` ضمن `serverkgg` في https://serverk.gg/llms.txt فور نشره. لتنشر الأداة بوتك وتضبط متغيراته وتقرأ سجل النشر، اربطها بواجهة MCP على `https://api.serverk.gg/mcp`.

`AGENTS.md` tells the AI tool you write your bot with all of the above. Serverk's `use-serverk` skill teaches it the whole workflow; its repository under `serverkgg` is named in https://serverk.gg/llms.txt once published. To let it deploy your bot, set its variables and read the deployment log, connect it to the Serverk MCP server at `https://api.serverk.gg/mcp`.

## على جهازك / On your machine

```sh
cp .env.example .env
npm install
npm run dev
```

ضع التوكن في `.env` على جهازك فقط، ولا ترفعه أبدًا. مكانه على Serverk متغيرات بوتك.

Keep the token in `.env` on your own machine only and never push it. On Serverk it belongs in your bot's variables.
