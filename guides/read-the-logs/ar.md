## سطور serverk

كل سطر يبدأ بـ `serverk:` صادر منا وليس من بوتك، ويوضح ما نفّذناه قبل أن يبدأ:

- `deploying ...`: بدأ نشر جديد.
- `fetching ... at ...` أو `unpacking snapshot ...`: نسحب الـ commit من الريبو، أو نفك الكود الذي رفعته.
- `installing dependencies ...`: نثبّت المكتبات.
- `dependencies are up to date`: لم يتغيّر شيء، فلم نعد التثبيت.
- `deployment ... ready at ...`: نجح النشر.
- `web address ... on port ...`: عنوان الويب لبوتك، والمنفذ الذي يلزم أن يستمع عليه، ما دام عنوان الويب مفعّلًا.
- `port 1 ...` و `port 2 ...`: رقم كل منفذ مفعّل، ومعه العنوان الذي يتصل به الآخرون إذا كان عنوان الويب مفعّلًا.
- `start command: ...`: الأمر الذي نشغّل به بوتك.
- `bot process starting`: بدأ بوتك، وكل سطر بعده يطبعه بوتك نفسه.

@[open](console)

## عندما يتعطّل بوتك

تظهر الأخطاء باللون الأحمر. اقرأ أول سطر أحمر، لا آخر سطر:

```txt
TypeError: Cannot read properties of undefined (reading 'send')
    at Client.<anonymous> (/home/container/index.js:12:18)
```

يوضح السطر الأول نوع الخطأ، ويوضح الذي بعده مكانه: الملف `index.js`، السطر 12.

## أشهر الأخطاء

- `deployment ... failed: sync: ...`: تعذّر سحب الـ commit. تأكد من وجود الريبو والفرع، ومن أن تطبيق Serverk على GitHub يصل إلى الريبو.
- `deployment ... failed: sync: repository tracks .serverk`: في الريبو مجلد `.serverk`، وهذا الاسم محجوز لمنصة سيرفرك. احذف المجلد من الريبو وانشر من جديد.
- `deployment ... failed: install: ...`: فشل تثبيت المكتبات، والسطر يوضح السبب. غالبًا يكون `package-lock.json` غير متوافق مع `package.json`، فشغّل `npm install` على جهازك وارفع ملف القفل الجديد.
- `deployment ... failed: start: nothing to start`: لم نجد طريقة لتشغيل بوتك. أضف `start` إلى `package.json`، أو اضبط أمر التشغيل من إعدادات بوتك.
- `TokenInvalid` أو `401 Unauthorized`: التوكن غير صحيح أو تغيّر. تأكد من اسم المتغير وقيمته، ثم انشر من جديد.
- `Used disallowed intents`: فعّل الـ intent الذي يطلبه بوتك من صفحة Bot في Developer Portal.
- `JavaScript heap out of memory`: استهلك بوتك الرام كاملة. انتقل إلى باقة أكبر، أو قلّل ما يحتفظ به بوتك في الذاكرة.

> [!note] إذا فشل النشر قبل أن يبدأ بوتك، فلا نعيد المحاولة حتى تصلح السبب. وإذا تعطّل بوتك بعد أن بدأ، نعمل له ريستارت، وإذا تعطّل 3 مرات خلال 10 دقائق نوقفه حتى لا يدخل في حلقة متكررة. أصلح الخطأ وانشر من جديد، أو ارجع إلى آخر نشر كان شغّالًا.
