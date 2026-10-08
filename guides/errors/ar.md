## ابحث عن السطر

عندما يتوقف بوتك عند أحد السطور التالية، تعرض صفحته السبب وما يلزم فعله. ابحث عن السطر في الكونسول، ثم اقرأ قسمه هنا. نسخنا كل سطر كما تطبعه المكتبة، ويكفي أوله للمطابقة.

@[open](console)

## التوكن غير صحيح

- في discord.js: `Error [TokenInvalid]: An invalid token was provided.`
- في grammY: `GrammyError: Call to 'getMe' failed! (401: Unauthorized)`، أو `GrammyError: Call to 'deleteWebhook' failed! (404: Not Found)`.

انسخ التوكن من جديد من Developer Portal أو BotFather، وحدّثه في المتغيرات، ثم انشر من جديد.

## الـ Intents المطلوبة غير مفعّلة

- في discord.js: `Error: Used disallowed intents`، أو `Error [DisallowedIntents]: Privileged intent provided is not enabled or whitelisted.`

فعّل الـ Intents التي يطلبها كودك من صفحة Bot في Developer Portal، ثم شغّل بوتك من جديد. ويوضح شرح «توكن بوت ديسكورد والـ Intents والصلاحيات» المفتاح الذي يحتاجه كل Intent.

## التوكن مستخدم في بوت آخر

- في grammY: `GrammyError: Call to 'getUpdates' failed! (409: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running)`

التوكن الواحد يشغّل بوتًا واحدًا فقط في الوقت نفسه. وقّف النسخة الأخرى، مثل نسخة على جهازك، أو أرسل `/revoke` إلى BotFather لتأخذ توكنًا جديدًا، وحدّثه في المتغيرات، ثم انشر من جديد.

## مكتبة ناقصة

- `Error: Cannot find module 'discord.js'`
- `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'telegraf' imported from /home/container/index.js`

أضف المكتبة إلى `dependencies` في `package.json`، وارفع معها ملف القفل، ثم انشر من جديد. والأمر `npm install discord.js` على جهازك يحدّث الملفين. وإذا كان الاسم الناقص يبدأ بـ `./`، فهو ملف من كودك: تأكد من مساره ومن حالة الأحرف، لأن أسماء الملفات هنا تفرّق بين الأحرف الكبيرة والصغيرة.

## تعذّر بناء إحدى المكتبات

- `gyp ERR! stack Error: not found: make`

هذا خلل من جهتنا، [تواصل معنا](/dashboard/support) لنضيف الأدوات التي تحتاجها المكتبة.

## ffmpeg غير متوفر

- `Error: spawn ffmpeg ENOENT`

هذا خلل من جهتنا، [تواصل معنا](/dashboard/support) لنضيف ffmpeg إلى بيئة التشغيل.

## تجاوز بوتك حد الطلبات

- في grammY: `GrammyError: Call to 'sendMessage' failed! (429: Too Many Requests: retry after 5)`
- أو السطر `error code: 1015`

عطه بضع دقائق قبل أن تشغّله من جديد، وراجع الكود الذي يرسل الطلبات في حلقة متكررة.

## الرام غير كافية أثناء التشغيل

لا تطبع المكتبة سطرًا لهذا السبب: يتوقف بوتك فورًا عندما يتجاوز رام باقتك، برمز الخروج `137`، وتعرض صفحته «الرام غير كافية». ارفع الباقة للحصول على رام أكثر، أو خفّف ما يحتفظ به بوتك في الذاكرة.

## الرام غير كافية أثناء التثبيت أو البناء

- `serverk: install failed: it ran out of memory and was stopped`
- ثم `serverk: deployment dep_a1b2c3d4 failed: install: out-of-memory`

ويظهر `build` مكان `install` إذا نفدت الرام أثناء البناء. ارفع الباقة للحصول على رام أكثر، ثم انشر من جديد.

> [!note] سطر غير موجود هنا؟ ما زال أول سطر أحمر في الكونسول يوضح الخطأ، ويشرح «اقرأ الكونسول وافهم ما حدث» طريقة قراءته.
