import { describe, expect, test } from "bun:test";
import { BridgeLifecycleSubject } from "@serverkgg/bridge";
import {
	BOT_PLATFORM,
	BotPlatform,
	DEPLOYMENT_ID,
	GIT_TOKEN,
	IDENTITY_CACHE_FILE,
	INSTALL_COMMAND,
	LAUNCHER_DEPLOYMENT_ID,
	LAUNCHER_GIT_TOKEN,
	LAUNCHER_INSTALL_COMMAND,
	LAUNCHER_REPO_BRANCH,
	LAUNCHER_REPO_REF,
	LAUNCHER_REPO_URL,
	LAUNCHER_STATE_DIR,
	REPO_REF,
	REPO_URL,
} from "@serverkgg/bridge/bot";
import { heapMb, LAUNCHER_NODE_OPTIONS, STATE_DIR } from "../shared";
import { fakeContext, SERVER_CODE } from "../testing";
import { lifecycle } from "./lifecycle";

const SHA = "0123456789abcdef0123456789abcdef01234567";

const TELEGRAM_TOKEN = "7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw";

const environmentOf = async (context: ReturnType<typeof fakeContext>["context"]) => {
	return (await lifecycle.environment?.(context)) ?? {};
};

describe("the bot process environment", () => {
	test("hands the bot every vault key exactly as the customer named it", async () => {
		const { context } = fakeContext({
			variables: {
				MY_VAR: "plain",
				guild_id: "42",
			},
			secrets: {
				TELEGRAM_TOKEN,
			},
			memoryMb: 512,
		});

		expect(await environmentOf(context)).toEqual({
			TZ: "UTC",
			HOME: "/home/container",
			NODE_OPTIONS: "--max-old-space-size=384",
			npm_config_cache: `${STATE_DIR}/cache/npm`,
			MY_VAR: "plain",
			guild_id: "42",
			TELEGRAM_TOKEN,
			[LAUNCHER_STATE_DIR]: STATE_DIR,
			SERVERK_BOT: "1",
			SERVERK_SERVER_CODE: SERVER_CODE,
			BOT_PLATFORM: BotPlatform.Telegram,
		});
	});

	test("keeps the customer's NODE_OPTIONS away from the launcher and never lets a vault key shadow PATH, HOME or a platform key", async () => {
		const { context } = fakeContext({
			variables: {
				NODE_OPTIONS: "--enable-source-maps",
				PATH: "/evil",
				HOME: "/tmp",
				SERVERK_BOT: "0",
				[BOT_PLATFORM]: BotPlatform.Discord,
				[REPO_URL]: "https://github.com/you/bot",
				[REPO_REF]: SHA,
				[DEPLOYMENT_ID]: "dep_a1b2c3d4",
				[INSTALL_COMMAND]: "npm install --legacy-peer-deps",
			},
			secrets: {
				[GIT_TOKEN]: "ghs_installation",
			},
		});
		const environment = await environmentOf(context);

		expect(environment.NODE_OPTIONS).toBe("--max-old-space-size=768");
		expect(environment[LAUNCHER_NODE_OPTIONS]).toBe("--enable-source-maps");
		expect(environment.PATH).toBeUndefined();
		expect(environment.HOME).toBe("/home/container");
		expect(environment.SERVERK_BOT).toBe("1");
		expect(environment.BOT_PLATFORM).toBe(BotPlatform.Discord);
		expect(environment[REPO_URL]).toBeUndefined();
		expect(environment[GIT_TOKEN]).toBeUndefined();
		expect(environment).toMatchObject({
			[LAUNCHER_REPO_URL]: "https://github.com/you/bot",
			[LAUNCHER_REPO_REF]: SHA,
			[LAUNCHER_REPO_BRANCH]: "main",
			[LAUNCHER_GIT_TOKEN]: "ghs_installation",
			[LAUNCHER_DEPLOYMENT_ID]: "dep_a1b2c3d4",
			[LAUNCHER_INSTALL_COMMAND]: "npm install --legacy-peer-deps",
		});
	});

	test("starts with no token at all, because nothing gates the start", async () => {
		const environment = await environmentOf(fakeContext().context);

		expect(environment.BOT_PLATFORM).toBeUndefined();
		expect(environment.SERVERK_BOT).toBe("1");
	});

	test("caps the node heap at three quarters of the plan's memory", () => {
		expect(heapMb(1024)).toBe(768);
		expect(heapMb(512)).toBe(384);
		expect(heapMb(32)).toBe(64);
	});

	test("starts the launcher with node", async () => {
		expect(await lifecycle.command(fakeContext().context)).toEqual([
			"node",
			"/serverk/launcher.mjs",
		]);
	});

	test("names the bot, not a game, in the bridge's lifecycle lines", () => {
		expect(lifecycle.subject).toBe(BridgeLifecycleSubject.Bot);
	});
});

describe("learning the bot's name", () => {
	test("remembers the name from the bot's own login line once it is ready", async () => {
		const { context, stored, print, followers } = fakeContext({
			secrets: {
				TELEGRAM_TOKEN,
			},
		});

		await lifecycle.onReady?.(context);

		print("Logged in as @serverk_test_bot");

		await Bun.sleep(5);

		expect(JSON.parse(stored.get(IDENTITY_CACHE_FILE) ?? "{}")).toMatchObject({
			platform: BotPlatform.Telegram,
			name: "serverk_test_bot",
		});
		expect(followers).toHaveLength(0);
	});

	test("listens for nothing while it cannot tell the platform", async () => {
		const { context, followers } = fakeContext();

		await lifecycle.onReady?.(context);

		expect(followers).toHaveLength(0);
	});
});
