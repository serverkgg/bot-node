import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	BOT_STATE_DIR,
	BotDeploymentOutcome,
	BotDeploymentStage,
	BotFramework,
	BotPlatform,
	BotRuntime,
	DEPLOY_MARKER as BRIDGE_DEPLOY_MARKER,
	LAUNCHER_KEYS as BRIDGE_LAUNCHER_KEYS,
	botDeploymentStateSchema,
	deploymentLine as bridgeDeploymentLine,
	DEPLOYMENT_ID_PATTERN,
	DEPLOYMENT_LINE,
	DETECT_TABLE,
	detect,
	detectWantedFiles,
	parseServerkJson,
	REPO_BRANCH_PATTERN,
	REPO_REF_PATTERN,
	REPO_URL_PATTERN,
	ROOT_DIRECTORY_LENGTH_LIMIT,
	ROOT_DIRECTORY_PATTERN,
	renderDetectTable,
	SNAPSHOT_ID_PATTERN,
} from "@serverkgg/bridge/bot";
import {
	BUILT_IN_TABLE,
	botEnvironment,
	cleanSnapshots,
	commandWords,
	DEFAULT_STATE_DIR,
	DEPLOY_MARKER,
	DEPLOYMENT_STAMP,
	dependenciesCurrent,
	deploymentLine,
	detectManager,
	detectStart,
	doomedTags,
	failureDetail,
	gitArgv,
	gitEnvironment,
	HISTORY_DIR,
	HISTORY_KEEP,
	hasShellOperator,
	ID_PATTERN,
	REPO_BRANCH_PATTERN as LAUNCHER_BRANCH_PATTERN,
	LAUNCHER_KEYS,
	REPO_REF_PATTERN as LAUNCHER_REF_PATTERN,
	ROOT_DIRECTORY_LENGTH_LIMIT as LAUNCHER_ROOT_LIMIT,
	ROOT_DIRECTORY_PATTERN as LAUNCHER_ROOT_PATTERN,
	REPO_URL_PATTERN as LAUNCHER_URL_PATTERN,
	LaunchFailure,
	loadDetectTable,
	NODE_OPTIONS_KEY,
	newestFirst,
	Outcome,
	occupiedEntries,
	parseMarker,
	procfileCommand,
	READY_LINE,
	RESUME_KEY,
	relativeFile,
	repoHost,
	resolveProjectDir,
	resolveRequest,
	resumeStateOf,
	SNAPSHOT_STALE_MS,
	SNAPSHOTS_DIR,
	serverkJsonOf,
	shellCommand,
	startCandidates,
	syncDue,
	tableOf,
} from "../image/launcher.mjs";
import { READY_LINE as READY_PATTERN } from "./lifecycle";
import { LAUNCHER_NODE_OPTIONS, STATE_DIR } from "./shared";

const ROOT = new URL("..", import.meta.url).pathname;

const LAUNCHER = join(ROOT, "image", "launcher.mjs");

const TABLE_FILE = join(ROOT, "image", "detect.json");

const TEMPLATES = join(ROOT, "templates");

const ASKPASS = join(ROOT, "image", "git-askpass");

const REMOTE = "https://example.test/bots/sample";

const NPM_404_TRANSCRIPT = [
	"npm error code E404",
	"npm error 404 Not Found - GET https://registry.npmjs.org/serverk-no-such-package-e404-proof - Not found",
	"npm error 404",
	"npm error 404  The requested resource 'serverk-no-such-package-e404-proof@^1.0.0' could not be found or you do not have permission to access it.",
	"npm error 404",
	"npm error 404 Note that you can also install from a",
	"npm error 404 tarball, folder, http url, or git url.",
	"npm error A complete log of this run can be found in: /home/container/.serverk/cache/npm/_logs/2026-09-27T21_10_25_351Z-debug-0.log",
];

const NPM_404_DETAIL =
	"npm error code E404: 404 Not Found - GET https://registry.npmjs.org/serverk-no-such-package-e404-proof - Not found";

const SHA = "0123456789abcdef0123456789abcdef01234567";

const templateStart = (name: string) => {
	const dir = join(TEMPLATES, name);
	const packageJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
	const files = new Set(startCandidates(packageJson).filter((file: string) => existsSync(join(dir, file))));

	return detectStart(files, packageJson, {
		procfile: existsSync(join(dir, "Procfile")) ? readFileSync(join(dir, "Procfile"), "utf8") : null,
	});
};

describe("the detection table", () => {
	test("is the table the bridge renders, committed beside the launcher", () => {
		expect(readFileSync(TABLE_FILE, "utf8")).toBe(renderDetectTable());
	});

	test("matches the launcher's built-in fallback exactly", () => {
		expect(JSON.stringify(BUILT_IN_TABLE)).toBe(
			JSON.stringify({
				version: DETECT_TABLE.version,
				procfile: DETECT_TABLE.procfile,
				serverkJson: DETECT_TABLE.serverkJson,
				node: DETECT_TABLE.node,
			}),
		);
		expect(JSON.stringify(tableOf(readFileSync(TABLE_FILE, "utf8")))).toBe(JSON.stringify(BUILT_IN_TABLE));
	});

	test("falls back to the built-in table when the file is missing or broken", () => {
		expect(
			loadDetectTable({
				SERVERK_DETECT_TABLE: join(ROOT, "no-such-table.json"),
			}),
		).toBe(BUILT_IN_TABLE);
		expect(tableOf("{}")).toBeNull();
		expect(
			tableOf(
				JSON.stringify({
					...DETECT_TABLE,
					version: 2,
				}),
			),
		).toBeNull();
	});
});

describe("agreeing with the bridge", () => {
	test("enforces the same link, branch, commit and id rules", () => {
		expect(LAUNCHER_URL_PATTERN.source).toBe(REPO_URL_PATTERN.source);
		expect(LAUNCHER_BRANCH_PATTERN.source).toBe(REPO_BRANCH_PATTERN.source);
		expect(LAUNCHER_REF_PATTERN.source).toBe(REPO_REF_PATTERN.source);
		expect(ID_PATTERN.source).toBe(DEPLOYMENT_ID_PATTERN.source);
		expect(ID_PATTERN.source).toBe(SNAPSHOT_ID_PATTERN.source);
		expect(LAUNCHER_ROOT_PATTERN.source).toBe(ROOT_DIRECTORY_PATTERN.source);
		expect(LAUNCHER_ROOT_LIMIT).toBe(ROOT_DIRECTORY_LENGTH_LIMIT);
	});

	test("strips exactly the launcher keys the driver hands it, plus its own resume state", () => {
		expect(NODE_OPTIONS_KEY).toBe(LAUNCHER_NODE_OPTIONS);
		expect(
			[
				...LAUNCHER_KEYS,
			].sort(),
		).toEqual(
			[
				...BRIDGE_LAUNCHER_KEYS,
				LAUNCHER_NODE_OPTIONS,
				RESUME_KEY,
			].sort(),
		);
		expect(
			botEnvironment({
				SERVERK_GIT_TOKEN: "ghs_installation",
				SERVERK_REPO_REF: SHA,
				SERVERK_INSTALL_COMMAND: "npm i",
				DISCORD_TOKEN: "token",
				SERVERK_BOT: "1",
			}),
		).toEqual({
			DISCORD_TOKEN: "token",
			SERVERK_BOT: "1",
		});
	});

	test("prints deployment lines the bridge writes and reads the same way", () => {
		expect(
			deploymentLine("dep_a1b2c3d4", Outcome.Ready, {
				commit: SHA,
			}),
		).toBe(
			bridgeDeploymentLine({
				deployment: "dep_a1b2c3d4",
				outcome: BotDeploymentOutcome.Ready,
				commit: SHA,
			}),
		);
		expect(deploymentLine("dep_a1b2c3d4", Outcome.Ready)).toBe(
			bridgeDeploymentLine({
				deployment: "dep_a1b2c3d4",
				outcome: BotDeploymentOutcome.Ready,
				commit: null,
			}),
		);

		const failed = deploymentLine("dep_a1b2c3d4", Outcome.Failed, {
			stage: BotDeploymentStage.Install,
			detail: "npm error\n  code E404",
		});

		expect(failed).toBe(
			bridgeDeploymentLine({
				deployment: "dep_a1b2c3d4",
				outcome: BotDeploymentOutcome.Failed,
				stage: BotDeploymentStage.Install,
				detail: "npm error\n  code E404",
			}),
		);
		expect(DEPLOYMENT_LINE.exec(failed)?.groups?.stage).toBe("install");
	});

	test("reads the deploy marker where the bridge writes it, and the ready line the lifecycle waits for", () => {
		expect(BRIDGE_DEPLOY_MARKER).toBe(`${BOT_STATE_DIR}/${DEPLOY_MARKER}`);
		expect(DEFAULT_STATE_DIR).toBe(STATE_DIR);
		expect(READY_PATTERN.test(READY_LINE)).toBe(true);
	});
});

describe("resolving the root directory", () => {
	let root = "";

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "bot-node-root-"));
		mkdirSync(join(root, "apps", "bot"), {
			recursive: true,
		});
		writeFileSync(join(root, "file.txt"), "not a folder");
	});

	afterEach(() => {
		rmSync(root, {
			force: true,
			recursive: true,
		});
	});

	const detailOf = (run: () => unknown) => {
		try {
			run();
		} catch (error) {
			return error instanceof LaunchFailure ? `${error.stage}: ${error.detail}` : String(error);
		}

		return null;
	};

	test("keeps the checkout root when no root is set and resolves a nested one", () => {
		expect(resolveProjectDir(root, null, "sync")).toBe(root);
		expect(resolveProjectDir(root, "apps/bot", "sync")).toBe(realpathSync(join(root, "apps", "bot")));
	});

	test("names a missing root, a file, a climbing path and an escaping symlink", () => {
		symlinkSync(tmpdir(), join(root, "outside"));

		expect(detailOf(() => resolveProjectDir(root, "apps/nope", "snapshot"))).toBe(
			"snapshot: root directory apps/nope not found",
		);
		expect(detailOf(() => resolveProjectDir(root, "file.txt", "sync"))).toBe("sync: root directory file.txt not found");
		expect(detailOf(() => resolveProjectDir(root, "apps/../..", "sync"))).toBe(
			"sync: root directory apps/../.. is not valid",
		);
		expect(detailOf(() => resolveProjectDir(root, "outside", "sync"))).toBe(
			"sync: root directory outside leaves the bot folder",
		);
	});

	test("refuses a root that resolves inside .serverk or a .git folder", () => {
		mkdirSync(join(root, ".serverk", "history"), {
			recursive: true,
		});
		mkdirSync(join(root, "apps", ".git"), {
			recursive: true,
		});
		symlinkSync(join(root, ".serverk"), join(root, "state"));

		expect(detailOf(() => resolveProjectDir(root, "state", "sync"))).toBe(
			"sync: root directory state points inside .serverk",
		);
		expect(detailOf(() => resolveProjectDir(root, "apps/.git", "sync"))).toBe(
			"sync: root directory apps/.git points inside .git",
		);
		expect(detailOf(() => resolveProjectDir(root, ".serverk", "sync"))).toBe(
			"sync: root directory .serverk is not valid",
		);
	});
});

describe("reading a deploy request", () => {
	test("reads the JSON marker and drops values that are not safe", () => {
		expect(
			parseMarker(
				JSON.stringify({
					deployment: "dep_a1b2c3d4",
					ref: SHA,
					snapshot: null,
					reinstall: true,
					requestedAt: "2026-09-27T10:00:00.000Z",
				}),
			),
		).toEqual({
			deployment: "dep_a1b2c3d4",
			ref: SHA,
			snapshot: null,
			reinstall: true,
		});
		expect(
			parseMarker(
				JSON.stringify({
					deployment: "../x",
					ref: "main",
				}),
			),
		).toEqual({
			deployment: null,
			ref: null,
			snapshot: null,
			reinstall: false,
		});
	});

	test("still takes the timestamp marker older bridges leave", () => {
		expect(parseMarker("2026-09-27T10:00:00.000Z\n")).toEqual({
			deployment: null,
			ref: null,
			snapshot: null,
			reinstall: false,
		});
		expect(parseMarker(null)).toBeNull();
	});

	test("trusts the configured deployment over the marker and implies one the bot has not run", () => {
		const env = {
			SERVERK_DEPLOYMENT_ID: "dep_new",
			SERVERK_REPO_REF: SHA,
		};

		expect(
			resolveRequest(
				env,
				{
					deployment: "dep_old",
					ref: "f".repeat(40),
					snapshot: null,
					reinstall: false,
				},
				false,
				null,
			),
		).toEqual({
			deployment: "dep_new",
			ref: SHA,
			snapshot: null,
			reinstall: false,
			deploying: true,
		});
		expect(
			resolveRequest(env, null, false, {
				deployment: "dep_new",
				outcome: Outcome.Ready,
			}).deploying,
		).toBe(false);
		expect(
			resolveRequest(env, null, false, {
				deployment: "dep_new",
				outcome: Outcome.Failed,
			}).deploying,
		).toBe(true);
		expect(resolveRequest({}, null, true, null)).toEqual({
			deployment: null,
			ref: null,
			snapshot: null,
			reinstall: true,
			deploying: true,
		});
	});
});

describe("starting the templates", () => {
	test("runs both templates through their start script", () => {
		for (const name of [
			"discord-node",
			"telegram-node",
		]) {
			expect(templateStart(name)).toEqual({
				source: "start-script",
				argv: [
					"sh",
					"-c",
					"exec node index.js",
				],
			});
		}
	});

	test("installs both templates with npm ci from their committed lockfile", () => {
		for (const name of [
			"discord-node",
			"telegram-node",
		]) {
			expect(existsSync(join(TEMPLATES, name, "package-lock.json"))).toBe(true);
		}

		expect(
			detectManager(
				new Set([
					"package.json",
					"package-lock.json",
				]),
			),
		).toEqual({
			manager: "npm",
			lockfile: "package-lock.json",
		});
	});
});

describe("the templates as the platform inspects them", () => {
	const inspect = (name: string) => {
		const dir = join(TEMPLATES, name);
		const files = readdirSync(dir).map((path) => ({
			path,
		}));
		const contents = Object.fromEntries(
			detectWantedFiles(files).map((path) => [
				path,
				readFileSync(join(dir, path), "utf8"),
			]),
		);

		return detect({
			files,
			contents,
		});
	};

	test("detects each template cleanly and agrees with the launcher on how to start it", () => {
		const expected = {
			"discord-node": {
				platform: BotPlatform.Discord,
				framework: BotFramework.DiscordJs,
				tokenKey: "DISCORD_TOKEN",
			},
			"telegram-node": {
				platform: BotPlatform.Telegram,
				framework: BotFramework.Grammy,
				tokenKey: "TELEGRAM_TOKEN",
			},
		};

		for (const [name, wanted] of Object.entries(expected)) {
			const result = inspect(name);

			expect(result).toMatchObject({
				runtime: BotRuntime.Node,
				package: "bot-node",
				install: {
					command: "npm ci",
				},
				start: {
					command: "node index.js",
				},
				warnings: [],
				...wanted,
			});
			expect(templateStart(name)?.argv.at(-1)).toBe(`exec ${result.start?.command}`);
		}
	});
});

describe("detecting how to start a bot", () => {
	test("prefers the start command the customer typed over anything in the files", () => {
		expect(
			detectStart(
				new Set([
					"index.js",
				]),
				{
					scripts: {
						start: "node index.js",
					},
				},
				{
					startCommand: "  node dist/bot.js  ",
				},
			),
		).toEqual({
			source: "start-command",
			argv: [
				"sh",
				"-c",
				"exec node dist/bot.js",
			],
		});
	});

	test("reads operators only outside quotes and escapes, and keeps a compound command whole", () => {
		expect(hasShellOperator('node -e "a;b"')).toBe(false);
		expect(hasShellOperator("echo a\\;b")).toBe(false);
		expect(hasShellOperator("npm run build && node dist/bot.js")).toBe(true);
		expect(shellCommand("npm run build && node dist/bot.js")).toEqual([
			"sh",
			"-c",
			"npm run build && node dist/bot.js",
		]);
	});

	test("falls back to main, then the usual entry files, then the Procfile", () => {
		expect(
			detectStart(
				new Set([
					"src/app.js",
					"index.js",
				]),
				{
					main: "./src/app.js",
				},
			)?.argv,
		).toEqual([
			"node",
			"src/app.js",
		]);
		expect(
			detectStart(
				new Set([
					"src/bot.js",
					"index.ts",
				]),
				{},
			)?.argv,
		).toEqual([
			"node",
			"src/bot.js",
		]);
		expect(procfileCommand("web: node web.js\nbot: node a.js\nworker: node b.js")).toBe("node b.js");
		expect(detectStart(new Set(), {})).toBeNull();
	});

	test("ignores a main that points nowhere or outside the bot folder", () => {
		expect(relativeFile("../escape.js")).toBeNull();
		expect(relativeFile("/abs.js")).toBeNull();
		expect(relativeFile("./src/index.js")).toBe("src/index.js");
	});
});

const SERVERK_JSON_SAMPLES = [
	"{}",
	JSON.stringify({
		start: " node dist/bot.js ",
		install: "npm ci --omit=dev",
	}),
	JSON.stringify({
		runtime: "node",
		platform: "discord",
		framework: "discord-js",
		start: "node a.js",
		env: [
			"GUILD_ID",
			{
				key: "DISCORD_TOKEN",
				sensitive: true,
				example: "x",
			},
		],
	}),
	JSON.stringify({
		runtime: "go",
		start: "node a.js",
	}),
	JSON.stringify({
		platform: "slack",
		start: "node a.js",
	}),
	JSON.stringify({
		framework: "express",
		start: "node a.js",
	}),
	JSON.stringify({
		start: "",
	}),
	JSON.stringify({
		start: "a\nb",
	}),
	JSON.stringify({
		install: [
			"npm",
			"ci",
		],
	}),
	JSON.stringify({
		start: "x".repeat(1024),
	}),
	JSON.stringify({
		start: "x".repeat(1025),
	}),
	JSON.stringify({
		start: `echo ${"🤖".repeat(1019)}`,
	}),
	JSON.stringify({
		start: "node a.js",
		env: [
			"1BAD",
		],
	}),
	JSON.stringify({
		start: "node a.js",
		env: [
			{
				key: "A",
				sensitive: "yes",
			},
		],
	}),
	JSON.stringify({
		start: "node a.js",
		env: [
			{
				key: "A",
				example: "x".repeat(257),
			},
		],
	}),
	JSON.stringify({
		start: "node a.js",
		env: Array.from(
			{
				length: 101,
			},
			(_, index) => `KEY_${index}`,
		),
	}),
	"[]",
	"null",
	"not json",
];

const kitCommands = (raw: string) => {
	const parsed = parseServerkJson(raw);

	return parsed
		? {
				start: parsed.start,
				install: parsed.install,
			}
		: null;
};

describe("wrapping a command in a shell", () => {
	test("execs a plain command so the bot owns the process and gets the stop signal", () => {
		expect(shellCommand("node dist/bot.js")).toEqual([
			"sh",
			"-c",
			"exec node dist/bot.js",
		]);
		expect(shellCommand('node -e "start(1)"')).toEqual([
			"sh",
			"-c",
			'exec node -e "start(1)"',
		]);
	});

	test("puts leading assignments behind env so exec still finds the program", () => {
		expect(shellCommand("NODE_ENV=production node index.js")).toEqual([
			"sh",
			"-c",
			"exec env NODE_ENV=production node index.js",
		]);
		expect(shellCommand('A=1 B="two words" node index.js')).toEqual([
			"sh",
			"-c",
			'exec env A=1 B="two words" node index.js',
		]);
	});

	test("runs compound commands, subshells and shell builtins without exec", () => {
		for (const command of [
			"npm run build && node dist/bot.js",
			"node a.js || node b.js",
			"(cd app; node index.js)",
			"cd app",
			". ./env.sh",
			"source ./env.sh",
			"export A=1",
			"exec node index.js",
			"A=1",
		]) {
			expect(shellCommand(command), command).toEqual([
				"sh",
				"-c",
				command,
			]);
		}
	});

	test("splits words on whitespace outside quotes and escapes only", () => {
		expect(commandWords(`A="x y" node 'a b' c\\ d`)).toEqual([
			'A="x y"',
			"node",
			"'a b'",
			"c\\ d",
		]);
	});
});

describe("reading serverk.json", () => {
	test("agrees with the bridge's parser on every sample, broken files included", () => {
		for (const sample of SERVERK_JSON_SAMPLES) {
			expect(serverkJsonOf(sample), sample.slice(0, 80)).toEqual(kitCommands(sample));
		}
	});

	test("starts from the file's command after the customer's own and before anything detected", () => {
		const packageJson = {
			scripts: {
				start: "node index.js",
			},
		};
		const serverkJson = serverkJsonOf(
			JSON.stringify({
				start: "node dist/main.js",
			}),
		);

		expect(
			detectStart(new Set(), packageJson, {
				serverkJson,
			}),
		).toEqual({
			source: "serverk-json",
			argv: [
				"sh",
				"-c",
				"exec node dist/main.js",
			],
		});
		expect(
			detectStart(new Set(), packageJson, {
				startCommand: "node other.js",
				serverkJson,
			})?.source,
		).toBe("start-command");
	});
});

describe("the git environment", () => {
	test("drops every inherited GIT_ variable and the customer's variables, and pins the config", () => {
		const environment: Record<string, unknown> = gitEnvironment(
			{
				PATH: "/usr/bin",
				HOME: "/home/container",
				GIT_DIR: "/tmp/evil",
				GIT_CONFIG_COUNT: "1",
				GIT_SSH_COMMAND: "evil",
				HTTPS_PROXY: "http://evil:8080",
				DISCORD_TOKEN: "token",
			},
			null,
			null,
		);

		expect(environment).toEqual({
			PATH: "/usr/bin",
			HOME: "/home/container",
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_TERMINAL_PROMPT: "0",
		});
	});

	test("hands the token only through askpass, bound to the repository's host", () => {
		expect(gitEnvironment({}, "ghs_installation", "https://github.com:8443/you/bot")).toMatchObject({
			GIT_ASKPASS: "/serverk/git-askpass",
			SERVERK_GIT_TOKEN: "ghs_installation",
			SERVERK_GIT_HOST: "github.com:8443",
		});
		expect(repoHost("https://github.com/you/bot")).toBe("github.com");
	});

	test("turns off hooks, fsmonitor and every protocol but https on each call", () => {
		expect(gitArgv("fetch")).toEqual([
			"git",
			"-c",
			"core.hooksPath=/dev/null",
			"-c",
			"core.fsmonitor=false",
			"-c",
			"protocol.allow=never",
			"-c",
			"protocol.https.allow=always",
			"fetch",
		]);
	});

	test("answers askpass only for the repository's own host", () => {
		const ask = (prompt: string) => {
			const result = Bun.spawnSync(
				[
					"sh",
					ASKPASS,
					prompt,
				],
				{
					env: {
						SERVERK_GIT_HOST: "github.com",
						SERVERK_GIT_TOKEN: "ghs_installation",
					},
					stdout: "pipe",
				},
			);

			return {
				code: result.exitCode,
				answer: result.stdout.toString().trim(),
			};
		};

		expect(ask("Username for 'https://github.com': ")).toEqual({
			code: 0,
			answer: "x-access-token",
		});
		expect(ask("Password for 'https://x-access-token@github.com': ")).toEqual({
			code: 0,
			answer: "ghs_installation",
		});
		expect(ask("Password for 'https://x-access-token@evil.example': ").code).toBe(1);
		expect(ask("Username for 'https://github.com.evil.example': ").code).toBe(1);
	});
});

describe("recording why a command failed", () => {
	test("names npm's error code and reason, never the path of its debug log", () => {
		expect(failureDetail(NPM_404_TRANSCRIPT)).toBe(NPM_404_DETAIL);
	});

	test("reads an ERESOLVE, the older ERR! style and a transcript with no code line", () => {
		expect(
			failureDetail([
				"npm error code ERESOLVE",
				"npm error ERESOLVE unable to resolve dependency tree",
				"npm error",
				"npm error While resolving: bot@1.0.0",
				"npm notice New minor version of npm available!",
				"npm error A complete log of this run can be found in: /home/container/.npm/_logs/x-debug-0.log",
			]),
		).toBe("npm error code ERESOLVE: ERESOLVE unable to resolve dependency tree");
		expect(
			failureDetail([
				"npm ERR! code E404",
				"npm ERR! 404 Not Found - GET https://registry.npmjs.org/nope - Not found",
				"npm ERR! A complete log of this run can be found in:",
				"npm ERR!     /home/container/.npm/_logs/2026-09-27T10_00_00_000Z-debug-0.log",
			]),
		).toBe("npm ERR! code E404: 404 Not Found - GET https://registry.npmjs.org/nope - Not found");
		expect(
			failureDetail([
				"npm error 404 Not Found - GET https://registry.npmjs.org/nope - Not found",
				"npm error A complete log of this run can be found in: /tmp/x-debug-0.log",
			]),
		).toBe("npm error 404 Not Found - GET https://registry.npmjs.org/nope - Not found");
	});

	test("keeps the last informative line of anything that is not npm", () => {
		expect(
			failureDetail([
				"remote: Repository not found.",
				"fatal: repository 'https://github.com/you/bot/' not found",
				"",
			]),
		).toBe("fatal: repository 'https://github.com/you/bot/' not found");
		expect(failureDetail([])).toBeNull();
	});
});

describe("keeping the history small", () => {
	test("keeps the current snapshot and the ten newest others, and drops every other tag", () => {
		const tags = Array.from(
			{
				length: 14,
			},
			(_, index) => `snapshot-s${index}`,
		);

		expect(HISTORY_KEEP).toBe(10);
		expect(
			doomedTags(
				tags,
				[
					"deployment-dep_1",
				],
				"snapshot-s12",
			),
		).toEqual([
			"snapshot-s10",
			"snapshot-s11",
			"snapshot-s13",
			"deployment-dep_1",
		]);
	});

	test("orders snapshots by when they were made, falling back to the commit time", () => {
		expect(
			newestFirst([
				"snapshot-a 1790000000 created 1790000000100",
				"snapshot-b 1790000000 created 1790000000900",
				"snapshot-legacy 1789999000",
				"snapshot-c 1790000000 created 1790000000500",
			]),
		).toEqual([
			"snapshot-b",
			"snapshot-c",
			"snapshot-a",
			"snapshot-legacy",
		]);
	});

	test("drops stale zips and partial downloads, never the requested one or a fresh download", () => {
		const dir = mkdtempSync(join(tmpdir(), "bot-node-snapshots-"));
		const now = Date.now();
		const old = new Date(now - SNAPSHOT_STALE_MS - 60_000);

		try {
			for (const name of [
				"snap_keep.zip",
				"snap_old.zip",
				"snap_old2.zip.partial",
				"snap_fresh.zip.partial",
				"notes.txt",
			]) {
				writeFileSync(join(dir, name), "x");
			}

			for (const name of [
				"snap_keep.zip",
				"snap_old.zip",
				"snap_old2.zip.partial",
				"notes.txt",
			]) {
				utimesSync(join(dir, name), old, old);
			}

			cleanSnapshots(dir, "snap_keep", now);

			expect(readdirSync(dir).sort()).toEqual([
				"notes.txt",
				"snap_fresh.zip.partial",
				"snap_keep.zip",
			]);
		} finally {
			rmSync(dir, {
				force: true,
				recursive: true,
			});
		}
	});

	test("carries the request and synced source across the tokenless re-exec, and nothing else", () => {
		const state = {
			request: {
				deployment: "dep_1",
				ref: SHA,
				snapshot: null,
				reinstall: false,
				deploying: true,
			},
			synced: {
				source: "git",
				commit: SHA,
			},
		};

		expect(resumeStateOf(JSON.stringify(state))).toEqual(state);
		expect(
			resumeStateOf(
				JSON.stringify({
					...state,
					request: {
						...state.request,
						deployment: "../x",
					},
				}),
			),
		).toBeNull();
		expect(resumeStateOf(undefined)).toBeNull();
	});
});

describe("installing dependencies", () => {
	test("picks the package manager from the lockfile and npm install without one", () => {
		expect(
			detectManager(
				new Set([
					"package.json",
					"pnpm-lock.yaml",
				]),
			)?.manager,
		).toBe("pnpm");
		expect(
			detectManager(
				new Set([
					"package.json",
				]),
			),
		).toEqual({
			manager: "npm-install",
			lockfile: null,
		});
		expect(detectManager(new Set())).toBeNull();
	});

	test("skips an install whose hash matches and whose node_modules is where it was left", () => {
		expect(
			dependenciesCurrent(
				{
					hash: "same",
					modules: false,
				},
				"same",
				false,
			),
		).toBe(true);
		expect(
			dependenciesCurrent(
				{
					hash: "same",
				},
				"same",
				false,
			),
		).toBe(false);
		expect(dependenciesCurrent(null, "same", true)).toBe(false);
	});

	test("pulls a branch that has no pinned commit on a redeploy or after ten minutes", () => {
		const request = {
			deploy: false,
			checkout: true,
			repo: "https://github.com/you/bot",
			branch: "main",
			now: Date.parse("2026-09-27T12:00:00.000Z"),
		};
		const stamp = {
			repo: request.repo,
			branch: request.branch,
			syncedAt: "2026-09-27T11:55:00.000Z",
		};

		expect(syncDue(stamp, request)).toBe(false);
		expect(
			syncDue(stamp, {
				...request,
				deploy: true,
			}),
		).toBe(true);
		expect(
			syncDue(stamp, {
				...request,
				now: Date.parse("2026-09-27T12:06:00.000Z"),
			}),
		).toBe(true);
	});

	test("lets a checkout land over dependency folders but nothing else", () => {
		expect(
			occupiedEntries([
				".serverk",
				"node_modules",
				".venv",
				"__pycache__",
			]),
		).toEqual([]);
		expect(
			occupiedEntries([
				".serverk",
				"index.js",
			]),
		).toEqual([
			"index.js",
		]);
	});
});

const ROOTED = {
	"app/index.js": "console.log('cwd ' + process.cwd())",
	"app/package.json": JSON.stringify({
		scripts: {
			start: "node index.js",
		},
	}),
	"README.md": "sibling",
};

describe("running the launcher", () => {
	let root = "";
	let app = "";
	let state = "";

	const zipOf = (name: string, files: Record<string, string>) => {
		const source = join(root, `${name}-source`, "bot");

		mkdirSync(source, {
			recursive: true,
		});

		for (const [file, content] of Object.entries(files)) {
			mkdirSync(join(source, file, ".."), {
				recursive: true,
			});
			writeFileSync(join(source, file), content);
		}

		const archive = join(root, `${name}.zip`);

		Bun.spawnSync(
			[
				"python3",
				"-m",
				"zipfile",
				"-c",
				archive,
				"bot",
			],
			{
				cwd: join(root, `${name}-source`),
			},
		);

		return archive;
	};

	const place = (archive: string, snapshot: string) => {
		mkdirSync(join(state, SNAPSHOTS_DIR), {
			recursive: true,
		});
		writeFileSync(join(state, SNAPSHOTS_DIR, `${snapshot}.zip`), readFileSync(archive));
	};

	const launch = (env: Record<string, string>, mode: string[] = []) => {
		const result = Bun.spawnSync(
			[
				"node",
				LAUNCHER,
				...mode,
			],
			{
				cwd: app,
				env: {
					PATH: process.env.PATH ?? "/usr/bin:/bin",
					HOME: root,
					SERVERK_STATE_DIR: state,
					SERVERK_DETECT_TABLE: TABLE_FILE,
					SERVERK_START_COMMAND: "echo the bot ran",
					...env,
				},
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		return {
			code: result.exitCode,
			lines: result.stdout.toString().trim().split("\n"),
		};
	};

	const historyCount = () => {
		const result = Bun.spawnSync(
			[
				"git",
				`--git-dir=${join(state, HISTORY_DIR)}`,
				"rev-list",
				"--all",
				"--count",
			],
			{
				stdout: "pipe",
			},
		);

		return Number(result.stdout.toString().trim());
	};

	const stamp = () => {
		return botDeploymentStateSchema.parse(JSON.parse(readFileSync(join(state, DEPLOYMENT_STAMP), "utf8")));
	};

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "bot-node-launcher-"));
		app = join(root, "app");
		state = join(app, BOT_STATE_DIR);

		mkdirSync(state, {
			recursive: true,
		});
	});

	afterEach(() => {
		rmSync(root, {
			force: true,
			recursive: true,
		});
	});

	test("deploys an uploaded snapshot, dotfiles included, and announces it before the ready line", () => {
		place(
			zipOf("one", {
				"index.js": "run()",
				".env.example": "DISCORD_TOKEN=",
				"lib/old.js": "old",
			}),
			"snap_1",
		);

		const { code, lines } = launch({
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});

		expect(code).toBe(0);
		expect(lines.slice(-4)).toEqual([
			"serverk: deployment dep_1 ready",
			"serverk: start command: sh -c exec echo the bot ran",
			READY_LINE,
			"the bot ran",
		]);
		expect(readFileSync(join(app, ".env.example"), "utf8")).toBe("DISCORD_TOKEN=");
		expect(existsSync(join(app, "lib", "old.js"))).toBe(true);
		expect(existsSync(join(state, SNAPSHOTS_DIR, "snap_1.zip"))).toBe(false);
		expect(stamp()).toMatchObject({
			deployment: "dep_1",
			source: "snapshot",
			snapshot: "snap_1",
			outcome: "ready",
		});
	});

	test("drops files the next snapshot deleted, keeps the bot's own data, and rolls back without a download", () => {
		place(
			zipOf("one", {
				"index.js": "one()",
				"lib/old.js": "old",
			}),
			"snap_1",
		);
		launch({
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});
		writeFileSync(join(app, "data.db"), "runtime");

		place(
			zipOf("two", {
				"index.js": "two()",
			}),
			"snap_2",
		);

		expect(
			launch({
				SERVERK_SNAPSHOT_ID: "snap_2",
				SERVERK_DEPLOYMENT_ID: "dep_2",
			}).code,
		).toBe(0);
		expect(existsSync(join(app, "lib"))).toBe(false);
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("two()");
		expect(readFileSync(join(app, "data.db"), "utf8")).toBe("runtime");
		expect(historyCount()).toBe(2);

		const rollback = launch({
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_3",
		});

		expect(rollback.lines).toContain("serverk: restoring snapshot snap_1");
		expect(rollback.lines).toContain("serverk: deployment dep_3 ready");
		expect(readFileSync(join(app, "lib", "old.js"), "utf8")).toBe("old");
		expect(readFileSync(join(app, "data.db"), "utf8")).toBe("runtime");
		expect(historyCount()).toBe(2);

		expect(
			launch({
				SERVERK_SNAPSHOT_ID: "snap_2",
				SERVERK_DEPLOYMENT_ID: "dep_4",
			}).lines,
		).toContain("serverk: restoring snapshot snap_2");
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("two()");
		expect(historyCount()).toBe(2);
	});

	test("starts a deployment that already ran without announcing it again", () => {
		place(
			zipOf("one", {
				"index.js": "one()",
			}),
			"snap_1",
		);
		launch({
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});

		const again = launch({
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});

		expect(again.code).toBe(0);
		expect(again.lines.some((line) => DEPLOYMENT_LINE.test(line))).toBe(false);
		expect(historyCount()).toBe(1);
	});

	test("ends a failed deployment with the failure line and records it", () => {
		const { code, lines } = launch({
			SERVERK_SNAPSHOT_ID: "snap_missing",
			SERVERK_DEPLOYMENT_ID: "dep_9",
		});

		expect(code).toBe(1);
		expect(lines.at(-1)).toBe("serverk: deployment dep_9 failed: snapshot: snapshot snap_missing is not on this bot");
		expect(DEPLOYMENT_LINE.exec(lines.at(-1) ?? "")?.groups?.outcome).toBe("failed");
		expect(stamp()).toMatchObject({
			deployment: "dep_9",
			source: "snapshot",
			outcome: "failed",
			stage: "snapshot",
		});
	});

	test("takes the deploy marker, reinstalls with the customer's install command, and reinstalls when it changes", () => {
		writeFileSync(join(app, "package.json"), "{}");
		writeFileSync(
			join(state, DEPLOY_MARKER),
			JSON.stringify({
				deployment: null,
				ref: null,
				snapshot: null,
				reinstall: false,
			}),
		);

		const first = launch({
			SERVERK_INSTALL_COMMAND: "echo custom install",
		});

		expect(first.lines).toContain("serverk: installing dependencies: echo custom install");
		expect(first.lines).toContain("custom install");
		expect(existsSync(join(state, DEPLOY_MARKER))).toBe(false);

		expect(
			launch({
				SERVERK_INSTALL_COMMAND: "echo custom install",
			}).lines,
		).toContain("serverk: dependencies are up to date (custom)");

		expect(
			launch({
				SERVERK_INSTALL_COMMAND: "echo another install",
			}).lines,
		).toContain("serverk: installing dependencies: echo another install");
	});

	test("fails the install stage on a failing install command and never announces in install mode", () => {
		writeFileSync(join(app, "package.json"), "{}");

		const installMode = launch(
			{
				SERVERK_INSTALL_COMMAND: "echo nope >&2; exit 3",
				SERVERK_DEPLOYMENT_ID: "dep_1",
			},
			[
				"install",
			],
		);

		expect(installMode.code).toBe(1);
		expect(installMode.lines.at(-1)).toBe("serverk: install failed: nope");
		expect(installMode.lines.some((line) => DEPLOYMENT_LINE.test(line))).toBe(false);

		const startMode = launch({
			SERVERK_INSTALL_COMMAND: "echo nope >&2; exit 3",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});

		expect(startMode.lines.at(-1)).toBe("serverk: deployment dep_1 failed: install: nope");
	});
	const wrappedPath = (bare: string) => {
		const bin = join(root, "bin");
		const real = Bun.which("git") ?? "/usr/bin/git";

		mkdirSync(bin, {
			recursive: true,
		});
		writeFileSync(
			join(bin, "git"),
			`#!/bin/sh\nexec ${real} -c "url.file://${bare}.insteadOf=${REMOTE}" -c protocol.file.allow=always "$@"\n`,
			{
				mode: 0o755,
			},
		);

		return `${bin}:${process.env.PATH ?? "/usr/bin:/bin"}`;
	};

	const gitRemote = (files: Record<string, string> | null = null) => {
		const work = join(root, "remote-work");
		const bare = join(root, "sample.git");
		const git = (cwd: string, ...args: string[]) => {
			return Bun.spawnSync(
				[
					"git",
					"-c",
					"user.name=Serverk",
					"-c",
					"user.email=test@serverk.gg",
					...args,
				],
				{
					cwd,
					stdout: "pipe",
				},
			)
				.stdout.toString()
				.trim();
		};

		for (const [file, content] of Object.entries(files ?? ROOTED)) {
			mkdirSync(join(work, file, ".."), {
				recursive: true,
			});
			writeFileSync(join(work, file), content);
		}

		git(root, "init", "--quiet", "--bare", bare);
		git(work, "init", "--quiet", "-b", "main");
		git(work, "add", "--all");
		git(work, "commit", "--quiet", "-m", "one");
		git(work, "push", "--quiet", bare, "main");

		return {
			sha: git(work, "rev-parse", "HEAD"),
			env: {
				PATH: wrappedPath(bare),
				SERVERK_REPO_URL: REMOTE,
			},
		};
	};

	test("runs a pinned commit from its root directory, never from the checkout root", () => {
		const remote = gitRemote();
		const { code, lines } = launch({
			...remote.env,
			SERVERK_START_COMMAND: "",
			SERVERK_REPO_REF: remote.sha,
			SERVERK_DEPLOYMENT_ID: "dep_1",
			SERVERK_ROOT_DIRECTORY: "app",
		});

		expect(code).toBe(0);
		expect(lines).toContain(`serverk: deployment dep_1 ready at ${remote.sha.slice(0, 12)}`);
		expect(lines).toContain("serverk: start command: sh -c exec node index.js");
		expect(lines.at(-1)).toBe(`cwd ${realpathSync(join(app, "app"))}`);
		expect(readFileSync(join(app, "README.md"), "utf8")).toBe("sibling");
		expect(existsSync(join(app, "app", "package-lock.json"))).toBe(true);
		expect(existsSync(join(app, "package-lock.json"))).toBe(false);
	});

	test("runs an uploaded snapshot from its root directory, not beside the sibling files", () => {
		place(zipOf("rooted", ROOTED), "snap_r");

		const { code, lines } = launch({
			SERVERK_START_COMMAND: "",
			SERVERK_SNAPSHOT_ID: "snap_r",
			SERVERK_DEPLOYMENT_ID: "dep_r",
			SERVERK_ROOT_DIRECTORY: "app",
		});

		expect(code).toBe(0);
		expect(lines.at(-1)).toBe(`cwd ${realpathSync(join(app, "app"))}`);
		expect(readFileSync(join(app, "README.md"), "utf8")).toBe("sibling");
		expect(existsSync(join(state, HISTORY_DIR))).toBe(true);
		expect(stamp()).toMatchObject({
			deployment: "dep_r",
			outcome: "ready",
		});
	});

	test("fails the source stage on a missing root, and refuses a root that is not a plain folder path", () => {
		place(zipOf("rooted", ROOTED), "snap_r");

		const missing = launch({
			SERVERK_SNAPSHOT_ID: "snap_r",
			SERVERK_DEPLOYMENT_ID: "dep_m",
			SERVERK_ROOT_DIRECTORY: "nope",
		});

		expect(missing.code).toBe(78);
		expect(missing.lines.at(-1)).toBe("serverk: deployment dep_m failed: snapshot: root directory nope not found");
		expect(stamp()).toMatchObject({
			outcome: "failed",
			stage: "snapshot",
			detail: "root directory nope not found",
		});

		expect(
			launch({
				SERVERK_DEPLOYMENT_ID: "dep_c",
				SERVERK_ROOT_DIRECTORY: "..",
			}).lines.at(-1),
		).toBe("serverk: deployment dep_c failed: sync: root directory .. is not valid");

		symlinkSync(root, join(app, "escape"));

		expect(
			launch({
				SERVERK_DEPLOYMENT_ID: "dep_e",
				SERVERK_ROOT_DIRECTORY: "escape",
			}).lines.at(-1),
		).toBe("serverk: deployment dep_e failed: sync: root directory escape leaves the bot folder");
	});

	test("reinstalls when the root directory changes", () => {
		for (const folder of [
			"one",
			"two",
		]) {
			mkdirSync(join(app, folder));
			writeFileSync(join(app, folder, "package.json"), "{}");
		}

		const install = (folder: string) => {
			return launch({
				SERVERK_ROOT_DIRECTORY: folder,
				SERVERK_INSTALL_COMMAND: "echo custom install",
			}).lines;
		};

		expect(install("one")).toContain("serverk: installing dependencies: echo custom install");
		expect(install("one")).toContain("serverk: dependencies are up to date (custom)");
		expect(install("two")).toContain("serverk: installing dependencies: echo custom install");
	});

	const historyTags = () => {
		return Bun.spawnSync(
			[
				"git",
				`--git-dir=${join(state, HISTORY_DIR)}`,
				"tag",
				"--list",
			],
			{
				stdout: "pipe",
			},
		)
			.stdout.toString()
			.split("\n")
			.filter((line) => line.length > 0);
	};

	const corrupted = (archive: string) => {
		const bytes = readFileSync(archive);
		const data = 30 + bytes.readUInt16LE(26) + bytes.readUInt16LE(28);

		bytes[data + 2] = (bytes[data + 2] ?? 0) ^ 0xff;
		bytes[data + 3] = (bytes[data + 3] ?? 0) ^ 0xff;

		const broken = `${archive}.broken`;

		writeFileSync(broken, bytes);

		return broken;
	};

	test("runs a start command that sets a variable before the program", () => {
		writeFileSync(join(app, "index.js"), "console.log('env ' + process.env.NODE_ENV)");

		const { code, lines } = launch({
			SERVERK_START_COMMAND: "NODE_ENV=production node index.js",
		});

		expect(code).toBe(0);
		expect(lines).toContain("serverk: start command: sh -c exec env NODE_ENV=production node index.js");
		expect(lines.at(-1)).toBe("env production");
	});

	test("installs and starts with the commands serverk.json declares", () => {
		writeFileSync(join(app, "package.json"), "{}");
		writeFileSync(
			join(app, "serverk.json"),
			JSON.stringify({
				install: "echo declared install",
				start: "echo declared start",
			}),
		);

		const { code, lines } = launch({
			SERVERK_START_COMMAND: "",
		});

		expect(code).toBe(0);
		expect(lines).toContain("serverk: installing dependencies: echo declared install");
		expect(lines).toContain("serverk: start command: sh -c exec echo declared start");
		expect(lines.at(-1)).toBe("declared start");
	});

	test("applies the customer's NODE_OPTIONS to the bot only, never to the launcher or the install", () => {
		writeFileSync(join(app, "package.json"), "{}");
		writeFileSync(join(app, "index.js"), "console.log('bot ' + process.env.NODE_OPTIONS)");

		const { code, lines } = launch({
			NODE_OPTIONS: "--max-old-space-size=96",
			SERVERK_NODE_OPTIONS: "--enable-source-maps",
			SERVERK_INSTALL_COMMAND: "echo install $NODE_OPTIONS",
			SERVERK_START_COMMAND: "node index.js",
		});

		expect(code).toBe(0);
		expect(lines).toContain("install --max-old-space-size=96");
		expect(lines.at(-1)).toBe("bot --enable-source-maps");
	});

	test("boots uploaded code after a restore that dropped the history and the zips, and rebuilds the history later", () => {
		place(
			zipOf("one", {
				"index.js": "one()",
			}),
			"snap_1",
		);

		const env = {
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		};

		expect(launch(env).code).toBe(0);

		rmSync(join(state, HISTORY_DIR), {
			force: true,
			recursive: true,
		});
		rmSync(join(state, SNAPSHOTS_DIR), {
			force: true,
			recursive: true,
		});

		expect(
			launch(env, [
				"install",
			]).code,
		).toBe(0);

		const start = launch(env);

		expect(start.code).toBe(0);
		expect(start.lines).toContain("serverk: code is at snapshot snap_1");
		expect(start.lines.slice(-2)).toEqual([
			READY_LINE,
			"the bot ran",
		]);
		expect(start.lines.some((line) => DEPLOYMENT_LINE.test(line))).toBe(false);
		expect(stamp()).toMatchObject({
			deployment: "dep_1",
			outcome: "ready",
		});
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("one()");

		place(
			zipOf("two", {
				"index.js": "two()",
			}),
			"snap_2",
		);

		expect(
			launch({
				SERVERK_SNAPSHOT_ID: "snap_2",
				SERVERK_DEPLOYMENT_ID: "dep_2",
			}).code,
		).toBe(0);
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("two()");
		expect(historyCount()).toBe(1);
	});

	test("keeps the repository's code when the zip that replaces it is corrupt", () => {
		const remote = gitRemote();

		expect(
			launch({
				...remote.env,
				SERVERK_REPO_REF: remote.sha,
				SERVERK_DEPLOYMENT_ID: "dep_1",
			}).code,
		).toBe(0);

		place(
			corrupted(
				zipOf("broken", {
					"index.js": "x".repeat(4096),
				}),
			),
			"snap_bad",
		);

		const failed = launch({
			SERVERK_SNAPSHOT_ID: "snap_bad",
			SERVERK_DEPLOYMENT_ID: "dep_2",
		});

		expect(failed.code).toBe(1);
		expect(failed.lines.at(-1)).toStartWith("serverk: deployment dep_2 failed: snapshot: ");
		expect(existsSync(join(app, ".git"))).toBe(true);
		expect(readFileSync(join(app, "app", "index.js"), "utf8")).toBe(ROOTED["app/index.js"]);
		expect(existsSync(join(state, HISTORY_DIR))).toBe(false);
	});

	test("keeps the uploaded code when the repository that replaces it cannot be fetched", () => {
		place(
			zipOf("one", {
				"index.js": "one()",
			}),
			"snap_1",
		);

		expect(
			launch({
				SERVERK_SNAPSHOT_ID: "snap_1",
				SERVERK_DEPLOYMENT_ID: "dep_1",
			}).code,
		).toBe(0);

		const failed = launch({
			PATH: wrappedPath(join(root, "missing.git")),
			SERVERK_REPO_URL: REMOTE,
			SERVERK_REPO_REF: SHA,
			SERVERK_DEPLOYMENT_ID: "dep_2",
			SERVERK_GIT_TOKEN: "ghs_expired_token",
		});

		expect(failed.code).toBe(1);
		expect(failed.lines.at(-1)).toStartWith("serverk: deployment dep_2 failed: sync: ");
		expect(failed.lines.some((line) => line.includes("ما قدرنا نسحب كود بوتك"))).toBe(true);
		expect(failed.lines.join("\n")).not.toContain("ghs_expired_token");
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("one()");
		expect(existsSync(join(state, HISTORY_DIR))).toBe(true);
		expect(existsSync(join(app, ".git"))).toBe(false);
	});

	test("pulls a branch with no pinned commit, then starts the last pulled code when the pull fails", () => {
		const remote = gitRemote();
		const first = launch({
			...remote.env,
			SERVERK_REPO_BRANCH: "main",
		});

		expect(first.code).toBe(0);
		expect(first.lines).toContain(`serverk: code is at ${remote.sha.slice(0, 12)}`);
		expect(readFileSync(join(app, "README.md"), "utf8")).toBe("sibling");

		writeFileSync(
			join(state, DEPLOY_MARKER),
			JSON.stringify({
				deployment: null,
				ref: null,
				snapshot: null,
				reinstall: false,
			}),
		);

		const offline = launch({
			PATH: wrappedPath(join(root, "missing.git")),
			SERVERK_REPO_URL: REMOTE,
			SERVERK_REPO_BRANCH: "main",
		});

		expect(offline.code).toBe(0);
		expect(offline.lines.some((line) => line.startsWith("serverk: sync failed: "))).toBe(true);
		expect(offline.lines.at(-1)).toBe("the bot ran");
	});

	test("names a deleted commit only when the repository answers without it", () => {
		const remote = gitRemote();
		const failed = launch({
			...remote.env,
			SERVERK_REPO_REF: "f".repeat(40),
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});

		expect(failed.code).toBe(1);
		expect(failed.lines.at(-1)).toStartWith(
			"serverk: deployment dep_1 failed: sync: commit ffffffffffff is not in the repository",
		);
		expect(failed.lines.some((line) => line.includes("ما لقينا الكوميت"))).toBe(true);
	});

	test("refuses a repository that tracks .serverk instead of letting it overwrite the stamps", () => {
		const remote = gitRemote({
			"index.js": "run()",
			".serverk/deployment.json": "{}",
		});
		const failed = launch({
			...remote.env,
			SERVERK_REPO_REF: remote.sha,
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});

		expect(failed.code).toBe(1);
		expect(failed.lines.at(-1)).toBe("serverk: deployment dep_1 failed: sync: repository tracks .serverk");
		expect(stamp()).toMatchObject({
			deployment: "dep_1",
			outcome: "failed",
			stage: "sync",
		});
		expect(existsSync(join(app, ".git"))).toBe(false);
		expect(existsSync(join(app, "index.js"))).toBe(false);
	});

	test("installs and starts with no git token left in the launcher's own environment", () => {
		const remote = gitRemote({
			"index.js": "console.log('bot ' + (process.env.SERVERK_GIT_TOKEN ?? 'none'))",
			"package.json": "{}",
		});
		const { code, lines } = launch({
			...remote.env,
			SERVERK_REPO_REF: remote.sha,
			SERVERK_DEPLOYMENT_ID: "dep_1",
			SERVERK_GIT_TOKEN: "ghs_installation",
			SERVERK_INSTALL_COMMAND:
				"echo parent-token-$(tr '\\0' '\\n' < /proc/$PPID/environ | grep -c '^SERVERK_GIT_TOKEN=')",
			SERVERK_START_COMMAND: "node index.js",
		});

		expect(code).toBe(0);
		expect(lines).toContain("parent-token-0");
		expect(lines).toContain(`serverk: deployment dep_1 ready at ${remote.sha.slice(0, 12)}`);
		expect(lines.at(-1)).toBe("bot none");
	});

	const fakeNpmPath = () => {
		const bin = join(root, "npm-bin");

		mkdirSync(bin, {
			recursive: true,
		});
		writeFileSync(
			join(bin, "npm"),
			[
				"#!/bin/sh",
				'case "$1" in',
				"\tci)",
				'\t\tif grep -q from-source package-lock.json; then echo "npm ci ran"; exit 0; fi',
				'\t\techo "npm ci: package.json and package-lock.json are not in sync" >&2',
				"\t\texit 1",
				"\t\t;;",
				"\tinstall)",
				"\t\techo '{\"generated\": true}' > package-lock.json",
				'\t\techo "npm install ran"',
				"\t\texit 0",
				"\t\t;;",
				"esac",
				"exit 2",
				"",
			].join("\n"),
			{
				mode: 0o755,
			},
		);

		return `${bin}:${process.env.PATH ?? "/usr/bin:/bin"}`;
	};

	const deployWithNpm = (name: string, files: Record<string, string>) => {
		place(zipOf(name, files), name);

		return launch({
			PATH: fakeNpmPath(),
			SERVERK_SNAPSHOT_ID: name,
			SERVERK_DEPLOYMENT_ID: `dep_${name}`,
		});
	};

	test("fails the install stage with npm's reason, not the path of its debug log", () => {
		const bin = join(root, "npm-404-bin");

		mkdirSync(bin, {
			recursive: true,
		});
		writeFileSync(
			join(bin, "npm"),
			`#!/bin/sh\ncat >&2 <<'TRANSCRIPT'\n${NPM_404_TRANSCRIPT.join("\n")}\nTRANSCRIPT\nexit 1\n`,
			{
				mode: 0o755,
			},
		);
		place(
			zipOf("npm404", {
				"package.json": '{"dependencies": {"serverk-no-such-package-e404-proof": "^1.0.0"}}',
			}),
			"snap_404",
		);

		const { code, lines } = launch({
			PATH: `${bin}:${process.env.PATH ?? "/usr/bin:/bin"}`,
			SERVERK_SNAPSHOT_ID: "snap_404",
			SERVERK_DEPLOYMENT_ID: "dep_404",
		});

		expect(code).toBe(1);
		expect(lines.at(-1)).toBe(`serverk: deployment dep_404 failed: install: ${NPM_404_DETAIL}`);
		expect(stamp()).toMatchObject({
			outcome: "failed",
			stage: "install",
			detail: NPM_404_DETAIL,
		});
	});

	test("drops a shipped lockfile with its snapshot and installs the next snapshot with npm install", () => {
		const first = deployWithNpm("snap_a", {
			"package.json": '{"name": "a"}',
			"package-lock.json": '{"from-source": true}',
		});

		expect(first.code).toBe(0);
		expect(first.lines).toContain("serverk: installing dependencies: npm ci");

		const second = deployWithNpm("snap_b", {
			"package.json": '{"name": "b"}',
		});

		expect(second.code).toBe(0);
		expect(second.lines).toContain("serverk: installing dependencies: npm install");
		expect(second.lines).toContain("serverk: deployment dep_snap_b ready");
		expect(second.lines.at(-1)).toBe("the bot ran");
	});

	test("installs with npm install when the next snapshot ships no lockfile, over the one npm generated before", () => {
		const first = deployWithNpm("snap_a", {
			"package.json": '{"name": "a"}',
		});

		expect(first.code).toBe(0);
		expect(first.lines).toContain("serverk: installing dependencies: npm install");
		expect(readFileSync(join(app, "package-lock.json"), "utf8")).toContain("generated");

		const second = deployWithNpm("snap_b", {
			"package.json": '{"name": "b"}',
		});

		expect(second.code).toBe(0);
		expect(second.lines).toContain("serverk: installing dependencies: npm install");
		expect(second.lines).toContain("serverk: deployment dep_snap_b ready");
		expect(second.lines.at(-1)).toBe("the bot ran");

		const restart = launch({
			PATH: fakeNpmPath(),
			SERVERK_SNAPSHOT_ID: "snap_b",
			SERVERK_DEPLOYMENT_ID: "dep_snap_b",
		});

		expect(restart.code).toBe(0);
		expect(restart.lines).toContain("serverk: dependencies are up to date (npm-install)");
	});

	test("installs a repository with npm install after a snapshot whose install generated a lockfile", () => {
		expect(
			deployWithNpm("snap_a", {
				"package.json": '{"name": "a"}',
			}).code,
		).toBe(0);
		expect(existsSync(join(app, "package-lock.json"))).toBe(true);

		fakeNpmPath();

		const remote = gitRemote({
			"package.json": '{"name": "from-git"}',
		});
		const switched = launch({
			...remote.env,
			PATH: `${join(root, "npm-bin")}:${remote.env.PATH}`,
			SERVERK_REPO_REF: remote.sha,
			SERVERK_DEPLOYMENT_ID: "dep_git",
		});

		expect(switched.code).toBe(0);
		expect(switched.lines).toContain("serverk: installing dependencies: npm install");
		expect(switched.lines).toContain(`serverk: deployment dep_git ready at ${remote.sha.slice(0, 12)}`);
	});

	test("keeps only the current snapshot and the ten before it, and drops stale zips", () => {
		for (let index = 1; index <= 12; index += 1) {
			place(
				zipOf(`s${index}`, {
					"index.js": `v${index}()`,
				}),
				`snap_${index}`,
			);

			expect(
				launch({
					SERVERK_SNAPSHOT_ID: `snap_${index}`,
					SERVERK_DEPLOYMENT_ID: `dep_${index}`,
				}).code,
			).toBe(0);
		}

		expect(historyTags()).toHaveLength(HISTORY_KEEP + 1);
		expect(historyTags()).not.toContain("snapshot-snap_1");
		expect(historyCount()).toBe(HISTORY_KEEP + 1);

		expect(
			launch({
				SERVERK_SNAPSHOT_ID: "snap_1",
				SERVERK_DEPLOYMENT_ID: "dep_13",
			}).lines.at(-1),
		).toBe("serverk: deployment dep_13 failed: snapshot: snapshot snap_1 is not on this bot");
		expect(
			launch({
				SERVERK_SNAPSHOT_ID: "snap_2",
				SERVERK_DEPLOYMENT_ID: "dep_14",
			}).code,
		).toBe(0);
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("v2()");
	}, 60_000);
});
