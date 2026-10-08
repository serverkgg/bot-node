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

نشغّل أمر سكربت `start` مباشرة، لا عبر `npm start`، فلا يشتغل سكربت `prestart`. ضع خطوته في `build` بدلًا منه.

## إصدار Node

يشتغل بوتك على Node 24، وهو الإصدار الموجود في بيئة التشغيل. نقرأ `engines.node` و `.nvmrc` و `.node-version` و `.tool-versions`، وإذا طلبت إصدارًا آخر ننبّهك في «شغّل بوتك»، ونطبع في الكونسول سطرًا مثل `the code asks for Node 18, this runtime is Node 24`، ثم نشغّل بوتك على Node 24.

## Bun وما في بيئة التشغيل

Bun موجود في بيئة التشغيل أيضًا: مع `bun.lock` نثبّت بـ `bun install --frozen-lockfile`، وأمر `start` مثل `bun run src/index.ts` يشغّل بوتك بـ Bun. وفيها كذلك `python3` و `make` و `g++` للمكتبات التي تُبنى عند التثبيت، و `ffmpeg` للصوت.
