## ابحث عن السطر

عندما يتوقف بوتك عند أحد السطور التالية، تعرض صفحته السبب وما يلزم فعله. ابحث عن السطر في الكونسول، ثم اقرأ قسمه هنا. نسخنا كل سطر كما تطبعه المكتبة، ويكفي أوله للمطابقة.

@[open](console)

## التوكن غير صحيح {#token-invalid}

- في discord.js: `Error [TokenInvalid]: An invalid token was provided.`
- في grammY: `GrammyError: Call to 'getMe' failed! (401: Unauthorized)`، أو `GrammyError: Call to 'deleteWebhook' failed! (404: Not Found)`.

انسخ التوكن من جديد من Developer Portal أو BotFather، وحدّثه في المتغيرات، ثم انشر من جديد.

## الـ Intents المطلوبة غير مفعّلة {#intents-disallowed}

- في discord.js: `Error: Used disallowed intents`، أو `Error [DisallowedIntents]: Privileged intent provided is not enabled or whitelisted.`

فعّل الـ Intents التي يطلبها كودك من صفحة Bot في Developer Portal، ثم شغّل بوتك من جديد. ويوضح شرح «توكن بوت ديسكورد والـ Intents والصلاحيات» المفتاح الذي يحتاجه كل Intent.

## التوكن مستخدم في بوت آخر {#token-in-use}

- في grammY: `GrammyError: Call to 'getUpdates' failed! (409: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running)`

التوكن الواحد يشغّل بوتًا واحدًا فقط في الوقت نفسه. وقّف النسخة الأخرى، مثل نسخة على جهازك، أو أرسل `/revoke` إلى BotFather لتأخذ توكنًا جديدًا، وحدّثه في المتغيرات، ثم انشر من جديد.

## الـ webhook مضبوط على التوكن {#webhook-active}

- `Conflict: can't use getUpdates method while webhook is active; use deleteWebhook to delete the webhook first`

يظهر هذا النص من تيليقرام داخل السطر الذي تطبعه المكتبة، عندما يسحب بوتك الرسائل بالـ polling وعلى توكنه webhook مضبوط من استضافة سابقة أو من وقت كان عنوان الويب فيه مفعّلًا. اختر إحدى الطريقتين:

- انقل كودك إلى الـ webhook وفعّل عنوان الويب، كما في شرح «عنوان الويب والمنافذ لبوتك».
- أو احذف الـ webhook مرة واحدة: افتح `https://api.telegram.org/botTOKEN/deleteWebhook` في المتصفح بعد وضع توكنك مكان `TOKEN`، ثم شغّل بوتك من جديد.

## مكتبة ناقصة {#missing-dependency}

- `Error: Cannot find module 'discord.js'`
- `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'telegraf' imported from /home/container/index.js`

أضف المكتبة إلى `dependencies` في `package.json`، وارفع معها ملف القفل، ثم انشر من جديد. والأمر `npm install discord.js` على جهازك يحدّث الملفين. وإذا كان الاسم الناقص يبدأ بـ `./`، فهو ملف من كودك: تأكد من مساره ومن حالة الأحرف، لأن أسماء الملفات هنا تفرّق بين الأحرف الكبيرة والصغيرة.

## تعذّر بناء إحدى المكتبات {#build-tools}

- `gyp ERR! stack Error: not found: make`

هذا خلل من جهتنا، [تواصل معنا](/dashboard/support) لنضيف الأدوات التي تحتاجها المكتبة.

## ffmpeg غير متوفر {#ffmpeg-missing}

- `Error: spawn ffmpeg ENOENT`

هذا خلل من جهتنا، [تواصل معنا](/dashboard/support) لنضيف ffmpeg إلى بيئة التشغيل.

## تجاوز بوتك حد الطلبات {#rate-limited}

- في grammY: `GrammyError: Call to 'sendMessage' failed! (429: Too Many Requests: retry after 5)`
- أو السطر `error code: 1015`

عطه بضع دقائق قبل أن تشغّله من جديد، وراجع الكود الذي يرسل الطلبات في حلقة متكررة.

## بوتك لا يستقبل على عنوان الويب {#web-not-listening}

عنوان الويب مفعّل، لكن لم يرد شيء على المنفذ الموجود في `PORT`، فتنبّهك صفحة بوتك، ويعرض عنوانه صفحة «البوت لا يستقبل الطلبات حاليًا». اجعل بوتك يستمع على `0.0.0.0` وعلى `Number(process.env.PORT)`، لا على `localhost` أو `127.0.0.1` ولا على رقم ثابت مثل `3000`، ثم انشر من جديد. ويوضح شرح «عنوان الويب والمنافذ لبوتك» الطريقة لكل مكتبة. وإذا كان بوتك لا يحتاج عنوان الويب، فأوقفه من **الإدارة**.

## بوتك يفتح المنفذ نفسه مرتين {#port-busy}

- `Error: listen EADDRINUSE: address already in use 0.0.0.0:8080`

لا يستخدم منافذ بوتك أي برنامج آخر، فهذا السطر يعني أن كودك يفتح المنفذ نفسه مرتين، مثل سيرفر Express لصفحاتك وسيرفر Telegraf للـ webhook كلاهما على `PORT`، أو سيرفر keep-alive قديم بجانبهما. افتح سيرفرًا واحدًا على `PORT` وأضف إليه كل المسارات، ثم انشر من جديد.

## فشل أمر ما قبل النشر {#pre-deploy}

- `serverk: deployment dep_a1b2c3d4 failed: pre-deploy:`

انتهى أمر ما قبل النشر بخطأ، فتوقف النشر ولم يبدأ بوتك. اقرأ السطور التي طبعها الأمر قبل هذا السطر في الكونسول. وغالبًا يكون السبب في متغير الاتصال بقاعدة البيانات، مثل `DATABASE_URL`: تأكد أنه في متغيرات بوتك وأن قاعدة البيانات تقبل الاتصال من خارج شبكتها، ثم انشر من جديد. وإذا كان الأمر الذي اكتشفناه لا يناسب مشروعك، فاكتب أمرك في إعدادات بوتك أو في الحقل `preDeploy` في `serverk.json`.

## توقف بوتك برمز الخروج `137` {#oom-kill}

نفدت رام باقتك وبوتك شغّال. لا يُطبع شيء في هذه الحالة: يتوقف بوتك فورًا برمز الخروج `137`، وتعرض صفحته «الرام غير كافية». ارفع الباقة للحصول على رام أكثر، أو خفّف ما يحتفظ به بوتك في الذاكرة.

## الرام غير كافية للتثبيت أو البناء أو التشغيل {#out-of-memory}

- `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
- `serverk: install failed: it ran out of memory and was stopped`
- ثم `serverk: deployment dep_a1b2c3d4 failed: install: out-of-memory`

يطبع Node السطر الأول عندما تمتلئ ذاكرته وبوتك شغّال. ويعني السطران الآخران أن الرام نفدت أثناء التثبيت، ويظهر `build` مكان `install` إذا نفدت أثناء البناء، و `pre-deploy` إذا نفدت أثناء أمر ما قبل النشر. ارفع الباقة للحصول على رام أكثر، ثم انشر من جديد.

> [!note] سطر غير موجود هنا؟ ما زال أول سطر أحمر في الكونسول يوضح الخطأ، ويشرح «اقرأ الكونسول وافهم ما حدث» طريقة قراءته.
