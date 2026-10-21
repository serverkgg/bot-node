![Node bot](assets/banner.webp)

# بوت نود (Node bot)

يضم هذا الريبو بيئة تشغيل بوت نود، وهي كل ما تحتاجه منصة سيرفرك لتشغيل بوتك. اربط ريبو GitHub أو ارفع كود بوتك، ونتعرف على طريقة تشغيله تلقائيًا. أضف متغيراتك، وانشر بضغطة واحدة، وتابع كل ما يطبعه بوتك لحظة بلحظة. أي بوت بـ Node.js أو TypeScript، مع npm أو pnpm أو Yarn أو Bun، يُنشر من GitHub أو ملف zip. صفحة البوتات: [serverk.gg/bots](https://serverk.gg/bots)

This repository holds the Node bot runtime: everything Serverk needs to run your bot. Link a GitHub repository or upload your bot's code, and we work out how to run it. Add your variables, deploy in one click, and follow everything your bot prints, live. Any Node.js or TypeScript bot, with npm, pnpm, Yarn or Bun, deployed from GitHub or a zip. Bots page: [serverk.gg/bots](https://serverk.gg/bots)

## Layout

- `serverk.yml`: the bot manifest with its metadata, resources, environment vault, backup rules and the guide list.
- `serverk.schema.json`: the JSON Schema of `serverk.yml` for the editor, written by `serverk-bridge schema`.
- `src/`: the driver, built on `@serverkgg/bridge`; `src/driver.ts` exports it and `src/main.ts` serves it.
- `image/Dockerfile`: the container image, with the compiled bridge as its entrypoint.
- `image/launcher.mjs`: what the bridge starts; it puts the deployed code in place, installs its dependencies and starts the bot.
- `image/detect.json`: the start and install table the launcher reads, written by `serverk-bridge detect-table`.
- `templates/`: starter bots, synced to the public `serverkgg/bot-template-*` repositories by `bunx outdo templates`.
- `assets/`: the logo and the banner the site and the panel show.
- `guides/<id>/ar.md` and `en.md`: the guide bodies; each guide's title, summary and tags live in `serverk.yml`.

## Guides

- [شغّل بوتك أول مرة · Run your bot for the first time](https://serverk.gg/bots/bot-node/guides/getting-started)
- [أضف التوكن والمتغيرات · Add the token and your variables](https://serverk.gg/bots/bot-node/guides/environment-variables)
- [انقل بوتك من استضافة أخرى · Move your bot in from another host](https://serverk.gg/bots/bot-node/guides/moving-in)
- [اربط بوتك بريبو GitHub · Link your bot to a GitHub repository](https://serverk.gg/bots/bot-node/guides/connect-github)
- [أضف زر النشر إلى ريبو بوتك · Add a deploy button to your repository](https://serverk.gg/bots/bot-node/guides/deploy-button)
- [النشرات والرجوع إلى إصدار سابق · Deployments and rolling back](https://serverk.gg/bots/bot-node/guides/deployments)
- [ارفع كود بوتك دون ريبو · Upload your bot's code without a repository](https://serverk.gg/bots/bot-node/guides/upload-zip)
- [قواعد رفع الكود · Upload rules](https://serverk.gg/bots/bot-node/guides/upload-rules)
- [كيف نثبّت مشروع Node ونشغّله · How we install and start a Node project](https://serverk.gg/bots/bot-node/guides/project-shapes)
- [بيانات بوتك والنسخ الاحتياطية · Your bot's data and backups](https://serverk.gg/bots/bot-node/guides/data-and-backups)
- [عنوان الويب والمنافذ لبوتك · Your bot's web address and ports](https://serverk.gg/bots/bot-node/guides/web-address)
- [توكن بوت ديسكورد والـ Intents والصلاحيات · Your Discord bot's token, intents and permissions](https://serverk.gg/bots/bot-node/guides/discord-token)
- [أين تجد توكن بوت تيليقرام · Where to find your Telegram bot token](https://serverk.gg/bots/bot-node/guides/telegram-token)
- [اقرأ الكونسول وافهم ما حدث · Read the console and work out what happened](https://serverk.gg/bots/bot-node/guides/read-the-logs)
- [أخطاء بوتك وحلولها · Your bot's errors and how to fix them](https://serverk.gg/bots/bot-node/guides/errors)

## Develop

Everything runs on [Bun](https://bun.sh).

- `bun install`: installs the dependencies, points Git at the hooks in `.githooks/` and writes `.claude/rules/package.md` from the bridge.
- `bun run check`: checks lint and formatting with Biome; `bun run fix` applies the fixes.
- `bun run tsc`: type-checks the code.
- `bun run test`: runs the tests.
- `bun run validate`: runs the checks the platform runs at publish, and fails while this README is out of date.
- `bun run compile`: builds `dist/bridge`, the linux/amd64 binary the image starts.

`.githooks/pre-commit` runs `bun run fix`, `bun run tsc`, `bun run test`, `bun run validate`, `bunx serverk-bridge schema --check` and `bunx serverk-bridge detect-table --check` before every commit. There is no CI: a commit that passes the hook is ready.

`bun install` runs `serverk-bridge link`, which links `@serverkgg/bridge` to a sibling `serverk` checkout at `../serverk/modules/bridge` when one exists. Never commit a `file:` or `link:` dependency.

## Contribute

افتح issue لأي مشكلة أو اقتراح، بالعربية أو بالإنجليزية. ينشر فريق سيرفرك هذا الريبو من ريبو `serverk` بالأمر `bunx outdo package --prod --name bot-node`، ويصل كل تغيير مدموج مع النشر التالي. العربية هي لغة المصدر: يُكتب كل نص يقرؤه العميل بالعربية أولًا، بلغة رسمية مع لمسة خليجية خفيفة، ثم بالإنجليزية. أبقِ أسماء الملفات والأوامر والمفاتيح بالحروف اللاتينية.

Open an issue for any problem or suggestion, in Arabic or English. Serverk releases this repository from `serverk` with `bunx outdo package --prod --name bot-node`; merged changes ride the next release. Arabic is the source language: every string a customer reads is written in Arabic first, formal with a light Gulf touch, then in English. Keep file names, commands and config keys in Latin script.

## License

الكود متاح للقراءة، وجميع الحقوق محفوظة لمنصة سيرفرك، ولا يُمنح أي ترخيص.

The code is public to read. All rights are reserved by Serverk, and no license is granted.

يُنشأ هذا الملف بالأمر `serverk-bridge readme` من `serverk.yml`، فعدّل ملف التعريف لا هذا الملف.

Generated by `serverk-bridge readme` from `serverk.yml`; edit the manifest, not this file.
