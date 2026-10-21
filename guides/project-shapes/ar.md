## كيف نختار أداة التثبيت

نختار من كودك، وأول تطابق هو المعتمد:

1. الحقل `packageManager` في `package.json`، مثل `pnpm@9.15.0`.
2. ملف قفل بهذا الترتيب: `pnpm-lock.yaml`، ثم `bun.lock` أو `bun.lockb`، ثم `yarn.lock`.
3. الملف `.yarnrc.yml`، أي Yarn 2 أو أحدث.
4. `engines.pnpm` أو `engines.bun` أو `engines.yarn` في `package.json`.
5. وإلا فـ npm، مع `package-lock.json` أو `npm-shrinkwrap.json` إذا وُجد.

وهذا أمر التثبيت لكل أداة، مع ملف القفل ثم دونه:

- npm: `npm ci`، أو `npm install`.
- pnpm: `corepack pnpm install --frozen-lockfile`، أو `corepack pnpm install`.
- Yarn 1: `corepack yarn install --frozen-lockfile`، أو `corepack yarn install`.
- Yarn 2 أو أحدث: `corepack yarn install --immutable`، أو `corepack yarn install --no-immutable`.
- Bun: `bun install --frozen-lockfile`، أو `bun install`.

يشغّل Corepack أداتي pnpm و Yarn بالإصدار المكتوب في `packageManager`. وارفع ملف القفل دائمًا، فبدونه قد يثبّت النشر إصدارات مكتبات لم تجربها.

ولا نعيد التثبيت إلا عند تغيّر أمر التثبيت أو إصدار Node أو `package.json` أو ملف القفل، وإلا يظهر في الكونسول `dependencies are up to date (npm)`.

@[open](console)

## البناء

إذا كان في `package.json` سكربت `build`، نشغّله بعد التثبيت بالأداة نفسها، مثل `npm run build`، في كل نشر، ولا نعيده عند الريستارت العادي. يظهر في الكونسول `building: npm run build` ثم `build finished`، وإذا فشل البناء يتوقف النشر في مرحلة `build`. ولأمر بناء مختلف، اكتبه في الحقل `build` في `serverk.json`.

## أمر ما قبل النشر

يشتغل أمر ما قبل النشر مرة واحدة في كل نشر، بعد التثبيت والبناء وقبل تشغيل بوتك، وهو مكان ترحيلات قاعدة البيانات. نشغّله في مجلد الكود بمتغيرات بوتك نفسها، و `node_modules/.bin` في المسار، فيعمل أمر مثل `prisma migrate deploy` كما هو. ولا نعيده عند الريستارت العادي، وإذا فشل النشر نشغّله من جديد في التشغيل التالي للنشر نفسه.

أول تطابق هو المعتمد:

1. أمر ما قبل النشر في إعدادات بوتك.
2. الحقل `preDeploy` في `serverk.json`.
3. `prisma migrate deploy` إذا كان في كودك الملف `prisma/migrations/migration_lock.toml`. وأبقِ `prisma` في مكتبات `package.json`.

يظهر في الكونسول `running the pre-deploy command: prisma migrate deploy` ثم `pre-deploy command finished`. وإذا فشل الأمر يتوقف النشر في مرحلة `pre-deploy` ولا يبدأ بوتك.

## أمر تنفّذه من الكونسول

يشتغل أمر ما قبل النشر مع كل نشر، فأبقِ ترحيلات قاعدة البيانات فيه. أما المهمة التي تنفّذها بنفسك مرة واحدة، فاكتب أمرها في الكونسول، مثل:

- `npx prisma db seed` لتعبئة قاعدة البيانات ببياناتها الأولى.
- `node scripts/backfill.js` لتنفيذ أحد سكربتاتك مرة واحدة.
- `npm ls discord.js` لمعرفة إصدار المكتبة المثبّت.

ننفّذ الأمر كما نشغّل بوتك: في مجلد الكود، وبالمستخدم نفسه الذي يشتغل به بوتك، ومعه متغيرات بوتك و `node_modules/.bin` في المسار. ويشتغل حتى لو كان بوتك متوقفًا أو متعطّلًا. ويظهر ما يطبعه في الكونسول، ثم السطر `serverk: command finished`، أو السطر `serverk: command failed (exit 1)`، والرقم فيه رمز خروج الأمر. ويعيد النشر التالي كل ملف يحمله الكود إلى حالته فيه، لذلك ضع أي تغيير دائم في كودك، مثل مكتبة جديدة.

ننفّذ أمرًا واحدًا في كل مرة، لمدة 10 دقائق على الأكثر، ويتوقف ما يطبعه عند 256 KiB. ولا يستقبل الأمر أي إدخال، فالأمر الذي يطرح سؤالًا ينتهي فورًا، لذلك أضف إليه خيار تجاوز الأسئلة، مثل `--yes`. وقبل أول نشر لبوتك، يظهر في الكونسول `serverk: deploy the bot first`.

@[open](console)

## TypeScript

- مع البناء: `"build": "tsc"` و `"start": "node dist/index.js"`. ويبقى `typescript` في `devDependencies` كما هو، لأننا نثبّتها أيضًا. ولا تضف `NODE_ENV=production` إلى المتغيرات، فمعه يتجاوز npm مكتبات `devDependencies` ولا يجد البناء `tsc`.
- دون بناء: إذا كان `index.ts` في أعلى الكود ولم نجد ملف تشغيل قبله، نشغّله بـ `node index.ts`، فيحذف Node الأنواع ويشغّل الملف. وإذا احتاج كودك إلى البناء قبل التشغيل، فأضف سكربت `build`.
- مع `tsx` في مكتباتك، يشتغل أمر `start` مثل `tsx src/index.ts`، لأن `node_modules/.bin` في المسار.

## كيف نشغّل بوتك

أول تطابق هو المعتمد:

1. أمر التشغيل في إعدادات بوتك.
2. الحقل `start` في `serverk.json`.
3. سطر `worker:` أو `bot:` في `Procfile`.
4. سكربت `start` في `package.json`.
5. الملف المذكور في `main` في `package.json`، بـ `node`.
6. `index.js` ثم `src/index.js` ثم `bot.js` ثم `src/bot.js` ثم `index.ts`، بـ `node`.

نشغّل أمر سكربت `start` مباشرة، لا عبر `npm start`، فلا يشتغل سكربت `prestart`. ضع خطوته في `build` بدلًا منه، أو في أمر ما قبل النشر إذا كانت ترحيلات قاعدة البيانات.

## إصدار Node

يشتغل بوتك على Node 24، وهو الإصدار الموجود في بيئة التشغيل. نقرأ `engines.node` و `.nvmrc` و `.node-version` و `.tool-versions`، وإذا طلبت إصدارًا آخر ننبّهك في «شغّل بوتك»، ونطبع في الكونسول سطرًا مثل `the code asks for Node 18, this runtime is Node 24`، ثم نشغّل بوتك على Node 24.

## Bun وما في بيئة التشغيل

Bun موجود في بيئة التشغيل أيضًا: مع `bun.lock` نثبّت بـ `bun install --frozen-lockfile`، وأمر `start` مثل `bun run src/index.ts` يشغّل بوتك بـ Bun. وفيها كذلك `python3` و `make` و `g++` للمكتبات التي تُبنى عند التثبيت، و `ffmpeg` للصوت.
