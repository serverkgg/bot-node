import { Bot } from "grammy";

const bot = new Bot(process.env.TELEGRAM_TOKEN);

bot.command("start", async (ctx) => {
	await ctx.reply(`Hi ${ctx.from?.first_name ?? "there"}! Your bot is running.`);
});

bot.on("message:text", async (ctx) => {
	await ctx.reply(ctx.message.text);
});

bot.catch((error) => {
	console.error("Update failed:", error.error);
});

process.once("SIGTERM", () => bot.stop());
process.once("SIGINT", () => bot.stop());

await bot.start({
	onStart: (me) => console.log(`Logged in as @${me.username}`),
});
