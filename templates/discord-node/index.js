import { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN;

const ping = new SlashCommandBuilder().setName("ping").setDescription("Replies with pong and the latency");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
	],
});

client.once(Events.ClientReady, async (ready) => {
	const rest = new REST().setToken(token);

	await rest.put(Routes.applicationCommands(client.application.id), {
		body: [
			ping.toJSON(),
		],
	});

	console.log(`Logged in as ${ready.user.tag}, /ping is registered`);
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand() || interaction.commandName !== "ping") {
		return;
	}

	await interaction.reply(`Pong! ${client.ws.ping}ms`);
});

await client.login(token);
