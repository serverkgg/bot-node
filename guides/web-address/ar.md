## ما يحصل عليه بوتك

لبوتك عنوان ويب بـ HTTPS ومنفذان إضافيان، وتبقى الثلاثة موقوفة حتى تفعّلها من **الإدارة**. ولا يفعّلها إلا بوت على باقة مدفوعة، فهي غير متاحة في الفترة التجريبية.

- عنوان الويب: `https://name.srvk.gg`، و `name` هو العنوان المخصص لبوتك، بشهادة نصدرها ونجددها بأنفسنا. يصل إليه الـ webhook من تيليقرام، وتفاعلات ديسكورد، وصفحات بوتك.
- المنفذ 1 والمنفذ 2: يستقبل كل منهما TCP و UDP على الرقم نفسه، دون شهادة.

## فعّل عنوان الويب

1. افتح **الإدارة** وفعّل عنوان الويب. ننفّذ لبوتك ريستارت ليصله العنوان.
2. اجعل بوتك يستمع على `0.0.0.0`، أي على كل العناوين لا على `localhost`، وعلى المنفذ الموجود في `PORT`. ونوجّه إلى هذا المنفذ كل طلب يصل إلى عنوانك.
3. راجع الكونسول: قبل أن يبدأ بوتك يظهر السطر `serverk: web address https://name.srvk.gg on port 8080`.

يستجيب العنوان بعد أن تصبح شهادته فعّالة. وتعرض **الإدارة** حالة الشهادة، وتنبّهك إذا كان بوتك لا يستقبل الطلبات. وننتظر رد بوتك على كل طلب 60 ثانية على الأكثر، ويمر الـ WebSocket أيضًا.

@[open](console)

## المتغيرات

ما دام عنوان الويب مفعّلًا، يصل إلى بوتك:

- `PORT`: المنفذ الذي يستمع عليه بوتك، مثل `8080`. ويحل محل أي `PORT` أضفته إلى المتغيرات.
- `SERVERK_WEB_URL`: العنوان كاملًا، مثل `https://name.srvk.gg`، دون `/` في آخره.
- `SERVERK_WEB_HOST`: اسم الدومين وحده، مثل `name.srvk.gg`.

اقرأ هذه القيم من `process.env` دائمًا ولا تكتبها في الكود، لأنها تتغيّر إذا غيّرت العنوان المخصص.

## تيليقرام بالـ webhook

مع الـ webhook يرسل تيليقرام الرسائل إلى عنوان بوتك مباشرة، بدلًا من أن يسحبها بوتك بالـ polling.

في Telegraf، يضبط `bot.launch` الـ webhook على عنوانك ويستمع على `PORT` بنفسه:

```js
bot.launch({
	webhook: {
		domain: process.env.SERVERK_WEB_HOST,
		port: Number(process.env.PORT),
	},
});
```

وفي grammY، استقبل الطلبات بـ Express واضبط الـ webhook عند كل تشغيل:

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

واحذف `bot.start()`، فلا يجتمع الـ polling والـ webhook على توكن واحد. وأضف `express` إلى `dependencies` في `package.json`.

## تفاعلات ديسكورد عبر HTTP

إذا ضبطت **Interactions Endpoint URL** لتطبيقك، ترسل ديسكورد أوامر السلاش والأزرار إلى عنوان بوتك بدلًا من اتصال الـ gateway:

1. أضف `DISCORD_PUBLIC_KEY` إلى المتغيرات، وقيمته **Public Key** من صفحة **General Information** لتطبيقك في Developer Portal.
2. استقبل الطلبات على المسار `/interactions`، وتحقق من توقيع كل طلب بمكتبة `discord-interactions` كما في المثال أدناه.
3. انشر بوتك، ثم اكتب في **Interactions Endpoint URL** قيمة `SERVERK_WEB_URL` وبعدها `/interactions`، مثل `https://name.srvk.gg/interactions`، واضغط **Save Changes**.

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

أضف `discord-interactions` و `express` إلى `dependencies`، ولا تضع `express.json()` قبل `verifyKeyMiddleware`، لأن التوقيع محسوب على الطلب كما وصل. وعند الحفظ ترسل ديسكورد طلب PING، ولا تحفظ العنوان إلا إذا رد بوتك بـ PONG وبالحالة 200 خلال 3 ثوانٍ، ويرد `verifyKeyMiddleware` عليه بنفسه. ويلزم الرد على كل تفاعل بعدها خلال 3 ثوانٍ أيضًا.

> [!warning] بعد حفظ العنوان تتوقف التفاعلات عن الوصول عبر الـ gateway، فلا يصل `interactionCreate` في discord.js. ولإرجاعها، احذف العنوان من الخانة واحفظ.

## صفحات بوتك

لتقديم صفحة أو لوحة من بوتك، افتح سيرفر Express واحدًا على `PORT`:

```js
import express from "express";

const app = express();

app.get("/health", (req, res) => {
	res.send("ok");
});

app.listen(Number(process.env.PORT), "0.0.0.0");
```

يستمع بوتك على منفذ ويب واحد، فإذا استخدمت الـ webhook أو تفاعلات ديسكورد أيضًا، فأضف مساراتها إلى السيرفر نفسه ولا تفتح سيرفرًا ثانيًا على `PORT`.

## المنفذ 1 والمنفذ 2

فعّل المنفذ الذي تحتاجه من **الإدارة**، فيصل رقمه إلى بوتك في `SERVERK_PORT_1` أو `SERVERK_PORT_2`. اجعل بوتك يستمع على `0.0.0.0` وعلى هذا الرقم نفسه، لا على `PORT`، ويستقبل المنفذ TCP و UDP على الرقم نفسه. ويتصل الآخرون ببوتك على `name.srvk.gg` مع الرقم، كما تعرضه صفحة بوتك.

ويظهر الرقم في الكونسول قبل أن يبدأ بوتك، مثل `serverk: port 1 on 29004`، أو `serverk: port 1 at name.srvk.gg:29004` إذا كان عنوان الويب مفعّلًا. واقرأه من المتغير دائمًا ولا تكتبه في الكود.

لا شهادة على هذين المنفذين، فما يمر عليهما غير مشفّر إلا إذا شفّره بوتك بنفسه. ولصفحات الويب والـ webhook استخدم عنوان الويب.

## إذا غيّرت العنوان المخصص

عند تغيير العنوان المخصص من **الإدارة** ننفّذ لبوتك ريستارت، فيصله `SERVERK_WEB_URL` الجديد، ونصدر شهادة للعنوان الجديد. ويتحدّث الـ webhook في تيليقرام تلقائيًا إذا كان كودك يضبطه عند كل تشغيل كما في الأمثلة أعلاه. أما في ديسكورد فحدّث **Interactions Endpoint URL** في Developer Portal بنفسك.

## ما لا يُسمح بتقديمه

قدّم على عنوانك ومنفذيك ما يخص بوتك فقط. ويُمنع كل ما يخالف [شروط الاستخدام](/legal/terms)، ومنه:

- صفحات تنتحل خدمة أخرى، أو تجمع كلمات المرور وبيانات الدخول.
- البروكسي والـ VPN وأي تمرير لاتصالات الآخرين.
- استضافة ملفات أو مواقع لا تخص بوتك.

نوقف عنوان الويب والمنافذ لأي بوت يخالف ذلك.
