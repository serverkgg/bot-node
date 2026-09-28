## سطور serverk

كل سطر يبدأ بـ `serverk:` جاي منا، مو من بوتك، ويوريك وش سوينا قبل ما يبدأ:

- `deploying ...`: بدأ نشر جديد.
- `fetching ... at ...` أو `unpacking snapshot ...`: نسحب الكوميت من الريبو، أو نفك النسخة اللي رفعتها.
- `installing dependencies ...`: نثبّت المكتبات.
- `dependencies are up to date`: ما تغيّر شيء، فما ثبّتنا من جديد.
- `deployment ... ready at ...`: نجح النشر.
- `start command: ...`: الأمر اللي نشغّل فيه بوتك.
- `bot process starting`: بدأ بوتك، وكل سطر بعده يطبعه بوتك نفسه.

@[open](console)

## لما يتعطّل بوتك

الأخطاء تطلع باللون الأحمر. اقرأ أول سطر أحمر، مو آخر سطر:

```txt
TypeError: Cannot read properties of undefined (reading 'send')
    at Client.<anonymous> (/home/container/index.js:12:18)
```

السطر الأول يقول وش الخطأ، واللي بعده يقول وينه: الملف `index.js`، السطر 12.

## أشهر الأخطاء

- `deployment ... failed: sync: ...`: ما قدرنا نسحب الكوميت. تأكد إن الريبو والفرع موجودين وإن تطبيق Serverk على GitHub يقدر يوصل للريبو.
- `deployment ... failed: sync: repository tracks .serverk`: الريبو فيه مجلد `.serverk`، وهذا الاسم محجوز لسيرفرك. احذف المجلد من الريبو وانشر من جديد.
- `deployment ... failed: install: ...`: فشل تثبيت المكتبات والسطر يقول السبب. غالباً `package-lock.json` مو متوافق مع `package.json`، فشغّل `npm install` على جهازك وارفع ملف القفل الجديد.
- `deployment ... failed: start: nothing to start`: ما لقينا طريقة نشغّل فيها بوتك. أضف `start` في `package.json`، أو حط أمر التشغيل من إعدادات بوتك.
- `TokenInvalid` أو `401 Unauthorized`: التوكن غلط أو تغيّر. تأكد من اسم المتغير وقيمته، وانشر من جديد.
- `Used disallowed intents`: فعّل الـ intent اللي يطلبه بوتك من Developer Portal في صفحة Bot.
- `JavaScript heap out of memory`: بوتك خلّص الرام. كبّر باقتك أو خفّف اللي يحفظه بوتك في الذاكرة.

> [!note] لو فشل النشر قبل ما يبدأ بوتك، ما نعيد المحاولة لين تصلّح السبب. ولو تعطّل بوتك بعد ما بدأ نعيد تشغيله، وإذا تعطّل 3 مرات خلال 10 دقايق نوقفه عشان ما يدور في حلقة. صلّح الخطأ وانشر من جديد، أو ارجع لآخر نشر كان شغّال.
