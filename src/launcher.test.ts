import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
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
	BotInspectWarning,
	BotPlatform,
	BotRuntime,
	DEPLOY_MARKER as BRIDGE_DEPLOY_MARKER,
	LAUNCHER_KEYS as BRIDGE_LAUNCHER_KEYS,
	botDeploymentStateSchema,
	deploymentLine as bridgeDeploymentLine,
	deploymentStageLine as bridgeStageLine,
	createBotReadiness,
	DEPLOYMENT_ID_PATTERN,
	DEPLOYMENT_LINE,
	DEPLOYMENT_STAGE_LINE,
	DEPLOYMENT_STATE_FILE,
	DETECT_TABLE,
	detect,
	detectWantedFiles,
	parseServerkJson,
	platformEnvironment,
	REPO_BRANCH_PATTERN,
	REPO_REF_PATTERN,
	REPO_URL_PATTERN,
	ROOT_DIRECTORY_LENGTH_LIMIT,
	ROOT_DIRECTORY_PATTERN,
	renderDetectTable,
	SNAPSHOT_ID_PATTERN,
} from "@serverkgg/bridge/bot";
import { BridgeCrashCause, BridgeCrashPhase, BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	BUILT_IN_TABLE,
	botEnvironment,
	buildCommand,
	buildEnvironment,
	CACHE_MANIFEST,
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
	ensureCacheManifest,
	exposureLines,
	failureDetail,
	gitArgv,
	gitEnvironment,
	HISTORY_DIR,
	HISTORY_KEEP,
	hasShellOperator,
	ID_PATTERN,
	installArgv,
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
	nodeRequirementOf,
	OUT_OF_MEMORY_DETAIL,
	Outcome,
	occupiedEntries,
	parseMarker,
	procfileCommand,
	READY_LINE,
	RESUME_KEY,
	readSourceFiles,
	relativeFile,
	repoHost,
	resolveProjectDir,
	resolveRequest,
	resumeStateOf,
	SNAPSHOT_STALE_MS,
	SNAPSHOTS_DIR,
	SOURCE_FILES,
	Stage,
	serverkJsonOf,
	shellCommand,
	stageFailure,
	startCandidates,
	startEnvironment,
	startRetryOf,
	syncDue,
	tableOf,
	toolEnvironment,
	writeSourceFiles,
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
	it("is the table the bridge renders, committed beside the launcher", () => {
		expect(readFileSync(TABLE_FILE, "utf8")).toBe(renderDetectTable());
	});

	it("matches the launcher's built-in fallback exactly", () => {
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

	it("falls back to the built-in table when the file is missing, broken or a version behind", () => {
		const nodeWith = (node: Record<string, unknown>) => {
			return tableOf(
				JSON.stringify({
					...DETECT_TABLE,
					node: {
						...DETECT_TABLE.node,
						...node,
					},
				}),
			);
		};

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
					version: 1,
				}),
			),
		).toBeNull();
		expect(
			tableOf(
				JSON.stringify({
					...DETECT_TABLE,
					node: null,
				}),
			),
		).toBeNull();
		expect(
			nodeWith({
				runCommands: {
					...DETECT_TABLE.node.runCommands,
					bun: [],
				},
			}),
		).toBeNull();
		expect(
			nodeWith({
				installCommands: {
					locked: DETECT_TABLE.node.installCommands.locked,
				},
			}),
		).toBeNull();
		expect(
			nodeWith({
				lockfiles: [
					{
						file: "yarn.lock",
					},
				],
			}),
		).toBeNull();
		expect(
			nodeWith({
				versionFiles: [
					{
						file: "Pipfile",
						key: "python_version(",
					},
				],
			}),
		).toBeNull();
		expect(
			nodeWith({
				enginesKey: null,
			}),
		).toBeNull();
	});
});

describe("agreeing with the bridge", () => {
	it("enforces the same link, branch, commit and id rules", () => {
		expect(LAUNCHER_URL_PATTERN.source).toBe(REPO_URL_PATTERN.source);
		expect(LAUNCHER_BRANCH_PATTERN.source).toBe(REPO_BRANCH_PATTERN.source);
		expect(LAUNCHER_REF_PATTERN.source).toBe(REPO_REF_PATTERN.source);
		expect(ID_PATTERN.source).toBe(DEPLOYMENT_ID_PATTERN.source);
		expect(ID_PATTERN.source).toBe(SNAPSHOT_ID_PATTERN.source);
		expect(LAUNCHER_ROOT_PATTERN.source).toBe(ROOT_DIRECTORY_PATTERN.source);
		expect(LAUNCHER_ROOT_LIMIT).toBe(ROOT_DIRECTORY_LENGTH_LIMIT);
	});

	it("strips exactly the launcher keys the driver hands it, plus its own resume state", () => {
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

	it("prints deployment lines the bridge writes and reads the same way", () => {
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

	it("reads the deploy marker where the bridge writes it, and the ready line the lifecycle waits for", () => {
		expect(BRIDGE_DEPLOY_MARKER).toBe(`${BOT_STATE_DIR}/${DEPLOY_MARKER}`);
		expect(DEFAULT_STATE_DIR).toBe(STATE_DIR);
		expect(READY_PATTERN.test(READY_LINE)).toBe(true);
	});

	it("names the web address and each raw port from the variables the bridge hands the bot, and nothing while they are off", () => {
		expect(
			exposureLines(
				platformEnvironment("bt7k2m9q4x", null, {
					web: 8080,
					webUrl: "https://mybot.srvk.gg",
					port1: 29_004,
					port2: 30_004,
				}),
			),
		).toEqual([
			"web address https://mybot.srvk.gg on port 8080",
			"port 1 at mybot.srvk.gg:29004",
			"port 2 at mybot.srvk.gg:30004",
		]);
		expect(
			exposureLines(
				platformEnvironment("bt7k2m9q4x", null, {
					web: null,
					webUrl: null,
					port1: null,
					port2: 30_004,
				}),
			),
		).toEqual([
			"port 2 on 30004",
		]);
		expect(exposureLines(platformEnvironment("bt7k2m9q4x", null))).toEqual([]);
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

	it("keeps the checkout root when no root is set and resolves a nested one", () => {
		expect(resolveProjectDir(root, null, "sync")).toBe(root);
		expect(resolveProjectDir(root, "apps/bot", "sync")).toBe(realpathSync(join(root, "apps", "bot")));
	});

	it("names a missing root, a file, a climbing path and an escaping symlink", () => {
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

	it("refuses a root that resolves inside .serverk or a .git folder", () => {
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
	it("reads the JSON marker and drops values that are not safe", () => {
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

	it("still takes the timestamp marker older bridges leave", () => {
		expect(parseMarker("2026-09-27T10:00:00.000Z\n")).toEqual({
			deployment: null,
			ref: null,
			snapshot: null,
			reinstall: false,
		});
		expect(parseMarker(null)).toBeNull();
	});

	it("trusts the configured deployment over the marker and implies one the bot has not run", () => {
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
	it("runs both templates through their start script", () => {
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

	it("installs both templates with npm ci from their committed lockfile", () => {
		for (const name of [
			"discord-node",
			"telegram-node",
		]) {
			const dir = join(TEMPLATES, name);
			const plan = detectManager(
				new Set(
					readdirSync(dir).filter((file) =>
						[
							"package.json",
							"package-lock.json",
						].includes(file),
					),
				),
				JSON.parse(readFileSync(join(dir, "package.json"), "utf8")),
			);

			expect(plan).toEqual({
				manager: "npm",
				locked: true,
				lockfile: "package-lock.json",
			});
			expect(installArgv(plan)).toEqual([
				"npm",
				"ci",
			]);
		}
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

	it("detects each template cleanly and agrees with the launcher on how to start it", () => {
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
	it("prefers the start command the customer typed over anything in the files", () => {
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

	it("reads operators only outside quotes and escapes, and keeps a compound command whole", () => {
		expect(hasShellOperator('node -e "a;b"')).toBe(false);
		expect(hasShellOperator("echo a\\;b")).toBe(false);
		expect(hasShellOperator("npm run build && node dist/bot.js")).toBe(true);
		expect(shellCommand("npm run build && node dist/bot.js")).toEqual([
			"sh",
			"-c",
			"npm run build && node dist/bot.js",
		]);
	});

	it("takes the Procfile's worker or bot line before the start script", () => {
		const packageJson = {
			scripts: {
				start: "node index.js",
			},
		};
		const files = new Set([
			"index.js",
		]);

		expect(
			detectStart(files, packageJson, {
				procfile: "web: node web.js\nbot: node bot.js",
			}),
		).toEqual({
			source: "procfile",
			argv: [
				"sh",
				"-c",
				"exec node bot.js",
			],
		});
		expect(
			detectStart(files, packageJson, {
				procfile: "web: node web.js",
			})?.source,
		).toBe("start-script");
		expect(
			detectStart(files, packageJson, {
				serverkJson: serverkJsonOf(
					JSON.stringify({
						start: "node dist/main.js",
					}),
				),
				procfile: "bot: node bot.js",
			})?.source,
		).toBe("serverk-json");
	});

	it("falls back to main, then the usual entry files", () => {
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

	it("ignores a main that points nowhere or outside the bot folder", () => {
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
		build: " npm run compile ",
	}),
	JSON.stringify({
		build: "",
	}),
	JSON.stringify({
		build: [
			"tsc",
		],
	}),
	JSON.stringify({
		build: "tsc\nnode dist/bot.js",
	}),
	JSON.stringify({
		build: "x".repeat(1025),
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
				build: parsed.build,
			}
		: null;
};

describe("wrapping a command in a shell", () => {
	it("execs a plain command so the bot owns the process and gets the stop signal", () => {
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

	it("puts leading assignments behind env so exec still finds the program", () => {
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

	it("runs compound commands, subshells and shell builtins without exec", () => {
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

	it("splits words on whitespace outside quotes and escapes only", () => {
		expect(commandWords(`A="x y" node 'a b' c\\ d`)).toEqual([
			'A="x y"',
			"node",
			"'a b'",
			"c\\ d",
		]);
	});
});

describe("reading serverk.json", () => {
	it("agrees with the bridge's parser on every sample, broken files included", () => {
		for (const sample of SERVERK_JSON_SAMPLES) {
			expect(serverkJsonOf(sample), sample.slice(0, 80)).toEqual(kitCommands(sample));
		}
	});

	it("starts from the file's command after the customer's own and before anything detected", () => {
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
	it("drops every inherited GIT_ variable and the customer's variables, and pins the config", () => {
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

	it("hands the token only through askpass, bound to the repository's host", () => {
		expect(gitEnvironment({}, "ghs_installation", "https://github.com:8443/you/bot")).toMatchObject({
			GIT_ASKPASS: "/serverk/git-askpass",
			SERVERK_GIT_TOKEN: "ghs_installation",
			SERVERK_GIT_HOST: "github.com:8443",
		});
		expect(repoHost("https://github.com/you/bot")).toBe("github.com");
	});

	it("turns off hooks, fsmonitor and every protocol but https on each call", () => {
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

	it("answers askpass only for the repository's own host", () => {
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

describe("retrying a deployment that failed at the start", () => {
	const failed = {
		deployment: "dep_1",
		source: "git",
		commit: "0123456789abcdef0123456789abcdef01234567",
		outcome: Outcome.Failed,
		stage: Stage.Start,
	};

	it("claims it only while the code on disk is still that deployment's own", () => {
		const request = {
			deploying: false,
		};

		expect(
			startRetryOf(request, failed, {
				source: "git",
				commit: failed.commit,
			}),
		).toEqual(failed);
		expect(
			startRetryOf(request, failed, {
				source: "git",
				commit: "fedcba9876543210fedcba9876543210fedcba98",
			}),
		).toBeNull();
		expect(
			startRetryOf(
				{
					deploying: true,
				},
				failed,
				{
					source: "git",
					commit: failed.commit,
				},
			),
		).toBeNull();
		expect(
			startRetryOf(
				request,
				{
					...failed,
					stage: Stage.Install,
				},
				{
					source: "git",
					commit: failed.commit,
				},
			),
		).toBeNull();
	});
});

describe("recording why a command failed", () => {
	it("names an install or build the memory limit killed out-of-memory, the cause the bridge names", () => {
		expect(OUT_OF_MEMORY_DETAIL).toBe(BridgeCrashCause.OutOfMemory);

		for (const stage of [
			Stage.Install,
			Stage.Build,
		]) {
			const failure = stageFailure(stage, "hint", {
				code: 137,
				killed: true,
				last: "➤ YN0000: ┌ Fetch step",
			});

			expect(failure.stage).toBe(stage);
			expect(failure.detail).toBe(OUT_OF_MEMORY_DETAIL);
			expect(failure.arabic).not.toBe("hint");
		}

		expect(
			stageFailure(Stage.Build, "hint", {
				code: 2,
				killed: false,
				last: "cannot find module discord.js",
			}).detail,
		).toBe("cannot find module discord.js");
	});

	it("names npm's error code and reason, never the path of its debug log", () => {
		expect(failureDetail(NPM_404_TRANSCRIPT)).toBe(NPM_404_DETAIL);
	});

	it("reads an ERESOLVE, the older ERR! style and a transcript with no code line", () => {
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

	it("keeps the last informative line of anything that is not npm", () => {
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
	it("keeps the current snapshot and the ten newest others, and drops every other tag", () => {
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

	it("orders snapshots by when they were made, falling back to the commit time", () => {
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

	it("drops stale zips and partial downloads, never the requested one or a fresh download", () => {
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

	it("carries the request and synced source across the tokenless re-exec, and nothing else", () => {
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

const managerOf = (files: string[], packageJson: Record<string, unknown> | null = {}) => {
	return detectManager(
		new Set([
			"package.json",
			...files,
		]),
		packageJson,
	);
};

const BUILD_SCRIPT = {
	scripts: {
		build: "tsc",
	},
};

describe("recording the files a deployment wrote", () => {
	it("reads back the hash of each file it wrote, and none outside the bot's own files", () => {
		const dir = mkdtempSync(join(tmpdir(), "bot-node-source-files-"));
		const sha = (content: string) => createHash("sha256").update(content).digest("hex");

		try {
			expect(readSourceFiles(dir)).toBeNull();

			mkdirSync(join(dir, "src"));
			writeFileSync(join(dir, "a.js"), "a");
			writeFileSync(join(dir, "src", "b.js"), "b");
			writeSourceFiles(dir, dir, [
				"src/b.js",
				"a.js",
				"src/b.js",
				"missing.js",
			]);

			expect(readSourceFiles(dir)).toEqual({
				"a.js": sha("a"),
				"src/b.js": sha("b"),
			});

			writeFileSync(
				join(dir, SOURCE_FILES),
				JSON.stringify({
					files: {
						"kept.js": sha("kept"),
						".gitignore": sha("ignore"),
						"short.js": "abc",
						"number.js": 7,
						".serverk/deployment.json": sha("x"),
						".git/config": sha("x"),
						"lib/.git/HEAD": sha("x"),
						"../outside.js": sha("x"),
						"lib/../up.js": sha("x"),
						"/etc/passwd": sha("x"),
						"lib//double.js": sha("x"),
						"./here.js": sha("x"),
					},
				}),
			);

			expect(readSourceFiles(dir)).toEqual({
				"kept.js": sha("kept"),
				".gitignore": sha("ignore"),
			});

			writeFileSync(
				join(dir, SOURCE_FILES),
				JSON.stringify({
					files: [
						"a.js",
					],
				}),
			);

			expect(readSourceFiles(dir)).toBeNull();
		} finally {
			rmSync(dir, {
				force: true,
				recursive: true,
			});
		}
	});
});

describe("installing dependencies", () => {
	it("reads the packageManager field before any lockfile, yarn 2 and later as Yarn Berry", () => {
		expect(
			managerOf(
				[
					"package-lock.json",
				],
				{
					packageManager: "pnpm@9.12.0",
				},
			),
		).toEqual({
			manager: "pnpm",
			locked: false,
			lockfile: null,
		});
		expect(
			managerOf(
				[
					"pnpm-lock.yaml",
				],
				{
					packageManager: " pnpm@9.12.0+sha512.abc ",
				},
			),
		).toEqual({
			manager: "pnpm",
			locked: true,
			lockfile: "pnpm-lock.yaml",
		});
		expect(
			managerOf(
				[
					"yarn.lock",
				],
				{
					packageManager: "yarn@1.22.22",
				},
			),
		).toEqual({
			manager: "yarn",
			locked: true,
			lockfile: "yarn.lock",
		});
		expect(
			managerOf(
				[
					"yarn.lock",
				],
				{
					packageManager: "yarn@4.5.0",
				},
			),
		).toEqual({
			manager: "yarn-berry",
			locked: true,
			lockfile: "yarn.lock",
		});
		expect(
			managerOf(
				[
					"bun.lockb",
				],
				{
					packageManager: "bun@1.1.38",
				},
			),
		).toEqual({
			manager: "bun",
			locked: true,
			lockfile: "bun.lockb",
		});
		expect(
			managerOf(
				[
					"npm-shrinkwrap.json",
				],
				{
					packageManager: "npm@10.9.0",
				},
			),
		).toEqual({
			manager: "npm",
			locked: true,
			lockfile: "npm-shrinkwrap.json",
		});
		expect(
			managerOf(
				[
					"pnpm-lock.yaml",
				],
				{
					packageManager: "deno@2.0.0",
				},
			)?.manager,
		).toBe("pnpm");
	});

	it("takes the pnpm, bun and yarn lockfiles before npm's, and yarn.lock beside .yarnrc.yml as Yarn Berry", () => {
		expect(
			managerOf([
				"package-lock.json",
				"pnpm-lock.yaml",
			]),
		).toEqual({
			manager: "pnpm",
			locked: true,
			lockfile: "pnpm-lock.yaml",
		});
		expect(
			managerOf([
				"package-lock.json",
				"bun.lock",
			]),
		).toEqual({
			manager: "bun",
			locked: true,
			lockfile: "bun.lock",
		});
		expect(
			managerOf([
				"bun.lockb",
			]),
		).toEqual({
			manager: "bun",
			locked: true,
			lockfile: "bun.lockb",
		});
		expect(
			managerOf([
				"yarn.lock",
				"bun.lock",
			])?.manager,
		).toBe("bun");
		expect(
			managerOf([
				"yarn.lock",
			]),
		).toEqual({
			manager: "yarn",
			locked: true,
			lockfile: "yarn.lock",
		});
		expect(
			managerOf([
				"yarn.lock",
				".yarnrc.yml",
			]),
		).toEqual({
			manager: "yarn-berry",
			locked: true,
			lockfile: "yarn.lock",
		});
	});

	it("falls back to .yarnrc.yml, then the engines managers, then npm, locked only by npm's own lockfile", () => {
		expect(
			managerOf([
				".yarnrc.yml",
				"package-lock.json",
			]),
		).toEqual({
			manager: "yarn-berry",
			locked: false,
			lockfile: null,
		});
		expect(
			managerOf([], {
				engines: {
					node: ">=20",
					yarn: "1.x",
					bun: ">=1",
				},
			}),
		).toEqual({
			manager: "bun",
			locked: false,
			lockfile: null,
		});
		expect(
			managerOf(
				[
					"package-lock.json",
				],
				{
					engines: {
						pnpm: ">=9",
					},
				},
			),
		).toEqual({
			manager: "pnpm",
			locked: false,
			lockfile: null,
		});
		expect(
			managerOf([
				"package-lock.json",
			]),
		).toEqual({
			manager: "npm",
			locked: true,
			lockfile: "package-lock.json",
		});
		expect(managerOf([], null)).toEqual({
			manager: "npm",
			locked: false,
			lockfile: null,
		});
		expect(
			detectManager(
				new Set([
					"package-lock.json",
				]),
				{},
			),
		).toBeNull();
	});

	it("installs frozen from a lockfile and plainly without one", () => {
		const cases: [
			string[],
			Record<string, unknown>,
			string,
		][] = [
			[
				[
					"package-lock.json",
				],
				{},
				"npm ci",
			],
			[
				[],
				{},
				"npm install",
			],
			[
				[
					"pnpm-lock.yaml",
				],
				{},
				"corepack pnpm install --frozen-lockfile",
			],
			[
				[],
				{
					engines: {
						pnpm: ">=9",
					},
				},
				"corepack pnpm install",
			],
			[
				[
					"yarn.lock",
				],
				{},
				"corepack yarn install --frozen-lockfile",
			],
			[
				[
					"yarn.lock",
					".yarnrc.yml",
				],
				{},
				"corepack yarn install --immutable",
			],
			[
				[
					".yarnrc.yml",
				],
				{},
				"corepack yarn install --no-immutable",
			],
			[
				[
					"bun.lock",
				],
				{},
				"bun install --frozen-lockfile",
			],
			[
				[],
				{
					packageManager: "bun@1.1.38",
				},
				"bun install",
			],
		];

		for (const [files, packageJson, command] of cases) {
			const plan = managerOf(files, packageJson);

			expect(plan ? installArgv(plan).join(" ") : null, command).toBe(command);
		}
	});

	it("decides the install, the lock and the build exactly as the bridge's inspection does", () => {
		const samples: [
			string[],
			Record<string, unknown>,
		][] = [
			[
				[],
				{},
			],
			[
				[
					"package-lock.json",
				],
				BUILD_SCRIPT,
			],
			[
				[
					"npm-shrinkwrap.json",
				],
				{},
			],
			[
				[
					"pnpm-lock.yaml",
					"package-lock.json",
				],
				BUILD_SCRIPT,
			],
			[
				[
					"bun.lock",
				],
				BUILD_SCRIPT,
			],
			[
				[
					"bun.lockb",
				],
				{},
			],
			[
				[
					"yarn.lock",
				],
				BUILD_SCRIPT,
			],
			[
				[
					"yarn.lock",
					".yarnrc.yml",
				],
				BUILD_SCRIPT,
			],
			[
				[
					".yarnrc.yml",
				],
				{},
			],
			[
				[],
				{
					...BUILD_SCRIPT,
					engines: {
						yarn: "1.x",
					},
				},
			],
			[
				[
					"package-lock.json",
				],
				{
					engines: {
						pnpm: ">=9",
					},
				},
			],
			[
				[
					"pnpm-lock.yaml",
				],
				{
					...BUILD_SCRIPT,
					packageManager: "yarn@4.5.0",
				},
			],
			[
				[
					"yarn.lock",
				],
				{
					packageManager: "yarn@1.22.22",
				},
			],
			[
				[],
				{
					...BUILD_SCRIPT,
					packageManager: "bun@1.1.38",
				},
			],
			[
				[
					"package-lock.json",
				],
				{
					packageManager: "npm@10.9.0",
					scripts: {
						build: "  ",
					},
				},
			],
		];

		for (const [files, packageJson] of samples) {
			const paths = [
				"package.json",
				...files,
			];
			const result = detect({
				files: paths.map((path) => ({
					path,
				})),
				contents: {
					"package.json": JSON.stringify(packageJson),
				},
			});
			const plan = managerOf(files, packageJson);
			const label = `${paths.join(", ")} ${JSON.stringify(packageJson)}`;

			expect(plan ? installArgv(plan).join(" ") : null, label).toBe(result.install?.command ?? null);
			expect(!plan?.locked, label).toBe(result.warnings.includes(BotInspectWarning.NoLockfile));
			expect(buildCommand(null, packageJson, plan?.manager ?? null)?.command ?? null, label).toBe(
				result.build?.command ?? null,
			);
		}
	});

	it("skips an install whose hash matches and whose node_modules is where it was left", () => {
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

	it("pulls a branch that has no pinned commit on a redeploy or after ten minutes", () => {
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

	it("lets a checkout land over dependency folders but nothing else", () => {
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

describe("building a bot", () => {
	it("runs the build script with the package manager's own run command", () => {
		const runs = {
			npm: "npm run build",
			pnpm: "corepack pnpm run build",
			yarn: "corepack yarn run build",
			"yarn-berry": "corepack yarn run build",
			bun: "bun run build",
		};

		for (const [manager, command] of Object.entries(runs)) {
			expect(buildCommand(null, BUILD_SCRIPT, manager), manager).toEqual({
				command,
				argv: command.split(" "),
			});
		}

		expect(
			buildCommand(
				null,
				{
					scripts: {
						build: " ",
					},
				},
				"npm",
			),
		).toBeNull();
		expect(
			buildCommand(
				null,
				{
					scripts: {
						start: "node index.js",
					},
				},
				"npm",
			),
		).toBeNull();
		expect(buildCommand(null, null, null)).toBeNull();
	});

	it("runs serverk.json's build command over the build script", () => {
		expect(
			buildCommand(
				serverkJsonOf(
					JSON.stringify({
						build: "npm run compile && npm run bundle",
					}),
				),
				BUILD_SCRIPT,
				"pnpm",
			),
		).toEqual({
			command: "npm run compile && npm run bundle",
			argv: [
				"sh",
				"-c",
				"npm run compile && npm run bundle",
			],
		});
		expect(
			buildCommand(
				serverkJsonOf(
					JSON.stringify({
						build: "tsc",
					}),
				),
				null,
				null,
			),
		).toEqual({
			command: "tsc",
			argv: [
				"sh",
				"-c",
				"exec tsc",
			],
		});
	});
});

describe("the install, build and bot environments", () => {
	const ENV = {
		PATH: "/usr/bin",
		DISCORD_TOKEN: "token",
		SERVERK_GIT_TOKEN: "ghs_installation",
		SERVERK_REPO_URL: REMOTE,
		SERVERK_INSTALL_COMMAND: "npm i",
		SERVERK_NODE_OPTIONS: "--enable-source-maps",
		SERVERK_LAUNCH_RESUME: "{}",
	};

	it("builds with node_modules/.bin on PATH, CI set, the caches in the state folder and no launcher key", () => {
		const environment: Record<string, unknown> = buildEnvironment(ENV, "/state", "/app/bot");

		expect(environment).toMatchObject({
			PATH: "/app/bot/node_modules/.bin:/usr/bin",
			DISCORD_TOKEN: "token",
			CI: "true",
			BUN_INSTALL_CACHE_DIR: "/state/cache/bun",
			npm_config_cache: "/state/cache/npm",
			COREPACK_HOME: "/state/cache/corepack",
		});
		expect(LAUNCHER_KEYS.filter((key) => key in environment)).toEqual([]);
		expect(toolEnvironment(ENV, "/state")).toMatchObject({
			CI: "true",
			BUN_INSTALL_CACHE_DIR: "/state/cache/bun",
		});
	});

	it("writes the CommonJS manifest over the tool caches when missing and leaves an existing one alone", () => {
		const state = mkdtempSync(join(tmpdir(), "bot-node-cache-"));
		const manifest = join(state, "cache", "package.json");

		try {
			ensureCacheManifest(state);

			expect(readFileSync(manifest, "utf8")).toBe(CACHE_MANIFEST);
			expect(JSON.parse(CACHE_MANIFEST)).toEqual({
				type: "commonjs",
			});

			writeFileSync(manifest, '{"type": "commonjs", "kept": true}');
			ensureCacheManifest(state);

			expect(readFileSync(manifest, "utf8")).toBe('{"type": "commonjs", "kept": true}');
		} finally {
			rmSync(state, {
				force: true,
				recursive: true,
			});
		}
	});

	it("keeps corepack and bun under the cache folder whatever the environment says", () => {
		expect(
			toolEnvironment(
				{
					COREPACK_HOME: "/home/container/.corepack",
					BUN_INSTALL_CACHE_DIR: "/home/container/.bun",
				},
				"/state",
			),
		).toMatchObject({
			COREPACK_HOME: "/state/cache/corepack",
			BUN_INSTALL_CACHE_DIR: "/state/cache/bun",
		});
	});

	it("starts the bot with its own NODE_OPTIONS and none of CI, the tool caches or the launcher keys", () => {
		const environment: Record<string, unknown> = startEnvironment(ENV, "/app/bot");

		expect(environment).toEqual({
			PATH: "/app/bot/node_modules/.bin:/usr/bin",
			DISCORD_TOKEN: "token",
			NODE_OPTIONS: "--enable-source-maps",
		});
	});
});

describe("reading the Node version the code asks for", () => {
	const reader = (files: Record<string, string>) => {
		return (file: string) => files[file] ?? null;
	};

	it("takes engines.node before the version files, a range as its lowest major", () => {
		const nvmrc = reader({
			".nvmrc": "20\n",
		});
		const engines = (node: string) => {
			return {
				engines: {
					node,
				},
			};
		};

		expect(nodeRequirementOf(engines(">=18"), nvmrc, 24)).toEqual({
			version: "18",
			unmet: false,
		});
		expect(nodeRequirementOf(engines("^18.17.0 || ^20"), nvmrc, 24)).toEqual({
			version: "18",
			unmet: true,
		});
		expect(nodeRequirementOf(engines("18.x - 22"), nvmrc, 22)).toEqual({
			version: "18",
			unmet: false,
		});
		expect(nodeRequirementOf(engines("<20"), nvmrc, 24)).toEqual({
			version: "19",
			unmet: true,
		});
		expect(nodeRequirementOf(engines("lts/*"), nvmrc, 24)).toEqual({
			version: "20",
			unmet: true,
		});
		expect(nodeRequirementOf(engines(" "), reader({}), 24)).toBeNull();
	});

	it("reads .nvmrc, .node-version and the nodejs line of .tool-versions, in that order", () => {
		expect(
			nodeRequirementOf(
				{},
				reader({
					".nvmrc": "v22.11.0\n",
					".node-version": "20",
				}),
				22,
			),
		).toEqual({
			version: "22",
			unmet: false,
		});
		expect(
			nodeRequirementOf(
				null,
				reader({
					".nvmrc": "lts/iron\n",
					".node-version": "# pinned\n20.18.1",
				}),
				24,
			),
		).toEqual({
			version: "20",
			unmet: true,
		});
		expect(
			nodeRequirementOf(
				{},
				reader({
					".tool-versions": "python 3.12.4\nnodejs 18.20.4\n",
				}),
				24,
			),
		).toEqual({
			version: "18",
			unmet: true,
		});
		expect(
			nodeRequirementOf(
				{},
				reader({
					".tool-versions": "python 3.12.4\n",
				}),
				24,
			),
		).toBeNull();
	});

	it("agrees with the bridge's inspection on the version and when the image misses it", () => {
		const image = Number(DETECT_TABLE.node.defaultVersion);
		const samples: [
			Record<string, unknown>,
			Record<string, string>,
		][] = [
			[
				{
					engines: {
						node: ">=22",
					},
				},
				{},
			],
			[
				{
					engines: {
						node: "^18 || ^20",
					},
				},
				{
					".nvmrc": "24",
				},
			],
			[
				{
					engines: {
						node: ">=20 <23",
					},
				},
				{},
			],
			[
				{
					engines: {
						node: "lts/*",
					},
				},
				{
					".node-version": "22.11.0",
				},
			],
			[
				{},
				{
					".nvmrc": "v24.1.0",
				},
			],
			[
				{},
				{
					".tool-versions": "nodejs 20.18.1",
				},
			],
			[
				{},
				{},
			],
		];

		for (const [packageJson, files] of samples) {
			const contents = {
				"package.json": JSON.stringify(packageJson),
				...files,
			};
			const result = detect({
				files: Object.keys(contents).map((path) => ({
					path,
				})),
				contents,
			});
			const requirement = nodeRequirementOf(packageJson, reader(files), image);
			const label = JSON.stringify(contents);

			expect(requirement?.version ?? null, label).toBe(result.nodeVersion);
			expect(requirement?.unmet ?? false, label).toBe(result.warnings.includes(BotInspectWarning.NodeVersionUnmet));
		}
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

const RUNTIME_FILES = {
	"data/bot.sqlite": "rows",
	"cache.json": "{}",
};

const REMOVED_ONE = "serverk: removed 1 file the source no longer carries";

const REMOVED_TWO = "serverk: removed 2 files the source no longer carries";

const KEPT_ONE = "serverk: kept 1 changed file the source no longer carries";

const IN_THE_WAY_ONE = "serverk: removed 1 path in the way of the source's files";

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

	const writeRuntime = () => {
		for (const [file, content] of Object.entries(RUNTIME_FILES)) {
			mkdirSync(join(app, file, ".."), {
				recursive: true,
			});
			writeFileSync(join(app, file), content);
		}
	};

	const expectRuntimeKept = () => {
		for (const [file, content] of Object.entries(RUNTIME_FILES)) {
			expect(readFileSync(join(app, file), "utf8")).toBe(content);
		}
	};

	const recorded = () => {
		return Object.keys(readSourceFiles(state) ?? {});
	};

	const stagesOf = (lines: string[]) => {
		return lines.filter((line) => DEPLOYMENT_STAGE_LINE.test(line));
	};

	const loseHistory = () => {
		for (const dir of [
			HISTORY_DIR,
			SNAPSHOTS_DIR,
		]) {
			rmSync(join(state, dir), {
				force: true,
				recursive: true,
			});
		}
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

	it("deploys an uploaded snapshot, dotfiles included, and records it without announcing it before the bot proves itself", () => {
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
		expect(lines.slice(-3)).toEqual([
			"serverk: start command: sh -c exec echo the bot ran",
			READY_LINE,
			"the bot ran",
		]);
		expect(lines.some((line) => DEPLOYMENT_LINE.test(line))).toBe(false);
		expect(readFileSync(join(app, ".env.example"), "utf8")).toBe("DISCORD_TOKEN=");
		expect(existsSync(join(app, "lib", "old.js"))).toBe(true);
		expect(existsSync(join(state, SNAPSHOTS_DIR, "snap_1.zip"))).toBe(false);
		expect(stamp()).toMatchObject({
			deployment: "dep_1",
			source: "snapshot",
			snapshot: "snap_1",
			outcome: "ready",
			settled: false,
		});
	});

	it("keeps the bot's own files and the dropped files it changed, replaces what a snapshot carries and drops the rest, on a deploy and a rollback", () => {
		place(
			zipOf("one", {
				"index.js": "one()",
				"config.json": "one",
				"lib/old.js": "old",
				"lib/tuned.js": "tuned",
			}),
			"snap_1",
		);
		launch({
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});
		writeRuntime();
		writeFileSync(join(app, "config.json"), "edited");
		writeFileSync(join(app, "lib", "tuned.js"), "mine");

		place(
			zipOf("two", {
				"index.js": "two()",
				"config.json": "two",
			}),
			"snap_2",
		);

		const second = launch({
			SERVERK_SNAPSHOT_ID: "snap_2",
			SERVERK_DEPLOYMENT_ID: "dep_2",
		});

		expect(second.code).toBe(0);
		expect(second.lines).toContain(REMOVED_ONE);
		expect(second.lines).toContain(KEPT_ONE);
		expect(existsSync(join(app, "lib", "old.js"))).toBe(false);
		expect(readFileSync(join(app, "lib", "tuned.js"), "utf8")).toBe("mine");
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("two()");
		expect(readFileSync(join(app, "config.json"), "utf8")).toBe("two");
		expect(recorded()).toEqual([
			"config.json",
			"index.js",
		]);
		expectRuntimeKept();
		expect(historyCount()).toBe(2);

		writeFileSync(join(app, "config.json"), "edited");

		const rollback = launch({
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_3",
		});

		expect(rollback.lines).toContain("serverk: restoring snapshot snap_1");
		expect(rollback.lines.some((line) => line.startsWith("serverk: removed"))).toBe(false);
		expect(stamp()).toMatchObject({
			deployment: "dep_3",
			outcome: "ready",
		});
		expect(readFileSync(join(app, "lib", "old.js"), "utf8")).toBe("old");
		expect(readFileSync(join(app, "lib", "tuned.js"), "utf8")).toBe("tuned");
		expect(readFileSync(join(app, "config.json"), "utf8")).toBe("one");
		expectRuntimeKept();
		expect(historyCount()).toBe(2);

		const forward = launch({
			SERVERK_SNAPSHOT_ID: "snap_2",
			SERVERK_DEPLOYMENT_ID: "dep_4",
		});

		expect(forward.lines).toContain("serverk: restoring snapshot snap_2");
		expect(forward.lines).toContain(REMOVED_TWO);
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("two()");
		expect(existsSync(join(app, "lib"))).toBe(false);
		expectRuntimeKept();
		expect(historyCount()).toBe(2);
	});

	it("prints each stage of a deployment once, the way the bridge reads it, before the bot starts", () => {
		place(
			zipOf("one", {
				"index.js": "run()",
			}),
			"snap_1",
		);

		const { code, lines } = launch({
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});

		expect(code).toBe(0);
		expect(stagesOf(lines)).toEqual([
			bridgeStageLine("dep_1", BotDeploymentStage.Snapshot),
			bridgeStageLine("dep_1", BotDeploymentStage.Install),
			bridgeStageLine("dep_1", BotDeploymentStage.Start),
		]);
		expect(lines.indexOf(bridgeStageLine("dep_1", BotDeploymentStage.Start))).toBeLessThan(lines.indexOf(READY_LINE));
	});

	it("prints the build stage only for a bot that builds, and no stage on a restart with nothing to deploy", () => {
		writeFileSync(join(app, "index.js"), "run()");
		writeFileSync(
			join(app, "serverk.json"),
			JSON.stringify({
				install: "echo declared install",
				build: "echo declared build",
			}),
		);

		const deployed = launch({
			SERVERK_DEPLOYMENT_ID: "dep_2",
		});

		expect(deployed.code).toBe(0);
		expect(stagesOf(deployed.lines)).toEqual([
			bridgeStageLine("dep_2", BotDeploymentStage.Sync),
			bridgeStageLine("dep_2", BotDeploymentStage.Install),
			bridgeStageLine("dep_2", BotDeploymentStage.Build),
			bridgeStageLine("dep_2", BotDeploymentStage.Start),
		]);

		const restart = launch({
			SERVERK_DEPLOYMENT_ID: "dep_2",
		});

		expect(restart.code).toBe(0);
		expect(stagesOf(restart.lines)).toEqual([]);
	});

	it("starts a deployment that already ran without announcing it again", () => {
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

	it("prints the web address and each raw port right before the start line, and none of them while they are off", () => {
		place(
			zipOf("one", {
				"index.js": "one()",
			}),
			"snap_1",
		);

		const deployment = {
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		};
		const off = launch({
			...deployment,
			PORT: "3000",
		});

		expect(off.code).toBe(0);
		expect(off.lines.filter((line) => /^serverk: (?:web address|port \d) /.test(line))).toEqual([]);

		const on = launch({
			...deployment,
			PORT: "8080",
			SERVERK_WEB_URL: "https://mybot.srvk.gg",
			SERVERK_WEB_HOST: "mybot.srvk.gg",
			SERVERK_PORT_1: "29004",
			SERVERK_PORT_2: "30004",
		});

		expect(on.code).toBe(0);
		expect(on.lines.slice(-6)).toEqual([
			"serverk: web address https://mybot.srvk.gg on port 8080",
			"serverk: port 1 at mybot.srvk.gg:29004",
			"serverk: port 2 at mybot.srvk.gg:30004",
			"serverk: start command: sh -c exec echo the bot ran",
			READY_LINE,
			"the bot ran",
		]);

		const raw = launch({
			...deployment,
			SERVERK_PORT_1: "29004",
		});

		expect(raw.lines.slice(-4)).toEqual([
			"serverk: port 1 on 29004",
			"serverk: start command: sh -c exec echo the bot ran",
			READY_LINE,
			"the bot ran",
		]);
	});

	it("ends a failed deployment with the failure line and records it", () => {
		const { code, lines } = launch({
			SERVERK_SNAPSHOT_ID: "snap_missing",
			SERVERK_DEPLOYMENT_ID: "dep_9",
		});

		expect(code).toBe(1);
		expect(stagesOf(lines)).toEqual([
			bridgeStageLine("dep_9", BotDeploymentStage.Snapshot),
		]);
		expect(lines.at(-1)).toBe("serverk: deployment dep_9 failed: snapshot: snapshot snap_missing is not on this bot");
		expect(DEPLOYMENT_LINE.exec(lines.at(-1) ?? "")?.groups?.outcome).toBe("failed");
		expect(stamp()).toMatchObject({
			deployment: "dep_9",
			source: "snapshot",
			outcome: "failed",
			stage: "snapshot",
		});
	});

	it("takes the deploy marker, reinstalls with the customer's install command, and reinstalls when it changes", () => {
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

	it("fails the install stage on a failing install command and never announces in install mode", () => {
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
		expect(stagesOf(installMode.lines)).toEqual([]);

		const startMode = launch({
			SERVERK_INSTALL_COMMAND: "echo nope >&2; exit 3",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});

		expect(startMode.lines.at(-1)).toBe("serverk: deployment dep_1 failed: install: nope");
	});

	it("fails a deployment whose install the memory limit killed with out-of-memory, not its last line", () => {
		writeFileSync(join(app, "package.json"), "{}");

		const { code, lines } = launch({
			SERVERK_INSTALL_COMMAND: "echo fetching; kill -9 $$",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});

		expect(code).toBe(1);
		expect(lines.at(-1)).toBe("serverk: deployment dep_1 failed: install: out-of-memory");
		expect(stamp()).toMatchObject({
			deployment: "dep_1",
			outcome: "failed",
			stage: "install",
			detail: OUT_OF_MEMORY_DETAIL,
		});
	});

	it("a start after a boot failure reports the same deployment ready when the bot survives", async () => {
		const emitted: {
			event: string;
			payload: unknown;
		}[] = [];
		const bridge = {
			files: {
				async exists(path: string) {
					return existsSync(join(app, path));
				},
				async read(path: string) {
					return readFileSync(join(app, path), "utf8");
				},
				async write(path: string, content: string) {
					writeFileSync(join(app, path), content);
				},
			},
			log: Object.assign(() => {}, {
				warn: () => {},
				error: () => {},
			}),
			emit(event: string, payload: unknown) {
				emitted.push({
					event,
					payload,
				});
			},
		} as unknown as Parameters<ReturnType<typeof createBotReadiness>["ready"]>[0];
		const readiness = createBotReadiness();

		place(
			zipOf("one", {
				"index.js": "run()",
			}),
			"snap_1",
		);
		readiness.launching();
		launch({
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});
		await readiness.ready(bridge);
		await readiness.exit(bridge, {
			cause: BridgeCrashCause.TokenInvalid,
			exitCode: 1,
			outOfMemory: false,
			phase: BridgeCrashPhase.Booting,
			uptimeSeconds: 2,
			restarting: false,
			looping: false,
			restarts: 0,
			lastLine: null,
		});

		expect(stamp()).toMatchObject({
			deployment: "dep_1",
			outcome: "failed",
			stage: "start",
		});

		readiness.launching();

		const again = launch({});

		await readiness.ready(bridge);
		await readiness.stable(bridge);

		expect(again.code).toBe(0);
		expect(again.lines.at(-1)).toBe("the bot ran");
		expect(existsSync(join(app, DEPLOYMENT_STATE_FILE))).toBe(true);
		expect(emitted.at(-1)).toEqual({
			event: BridgeEventName.ServerUpdated,
			payload: {
				kind: "deployment",
				deployment: "dep_1",
				outcome: "ready",
				commit: null,
			},
		});
		expect(stamp()).toMatchObject({
			deployment: "dep_1",
			outcome: "ready",
			settled: true,
		});
	});

	it("keeps the reason of an install that exited 137 on its own, with no kill behind it", () => {
		writeFileSync(join(app, "package.json"), "{}");

		const { lines } = launch({
			SERVERK_INSTALL_COMMAND: "echo nope >&2; exit 137",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});

		expect(lines.at(-1)).toBe("serverk: deployment dep_1 failed: install: nope");
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

		mkdirSync(work, {
			recursive: true,
		});

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

		const commit = (tree: Record<string, string>) => {
			for (const [file, content] of Object.entries(tree)) {
				mkdirSync(join(work, file, ".."), {
					recursive: true,
				});
				writeFileSync(join(work, file), content);
			}

			git(work, "add", "--all");
			git(work, "commit", "--quiet", "-m", "next");
			git(work, "push", "--quiet", bare, "main");

			return git(work, "rev-parse", "HEAD");
		};

		git(root, "init", "--quiet", "--bare", bare);
		git(work, "init", "--quiet", "-b", "main");

		return {
			sha: commit(files ?? ROOTED),
			env: {
				PATH: wrappedPath(bare),
				SERVERK_REPO_URL: REMOTE,
			},
			next: (tree: Record<string, string>) => {
				git(work, "rm", "--quiet", "-r", ".");

				return commit(tree);
			},
		};
	};

	it("runs a pinned commit from its root directory, never from the checkout root", () => {
		const remote = gitRemote();
		const { code, lines } = launch({
			...remote.env,
			SERVERK_START_COMMAND: "",
			SERVERK_REPO_REF: remote.sha,
			SERVERK_DEPLOYMENT_ID: "dep_1",
			SERVERK_ROOT_DIRECTORY: "app",
		});

		expect(code).toBe(0);
		expect(stamp()).toMatchObject({
			deployment: "dep_1",
			outcome: "ready",
			commit: remote.sha,
		});
		expect(lines).toContain("serverk: start command: sh -c exec node index.js");
		expect(lines.at(-1)).toBe(`cwd ${realpathSync(join(app, "app"))}`);
		expect(readFileSync(join(app, "README.md"), "utf8")).toBe("sibling");
		expect(existsSync(join(app, "app", "package-lock.json"))).toBe(true);
		expect(existsSync(join(app, "package-lock.json"))).toBe(false);
	});

	it("keeps the bot's own files and the dropped files it changed, replaces what a commit carries and drops the rest, on a deploy, a rollback and a pull", () => {
		const remote = gitRemote({
			"index.js": "one()",
			"config.json": "one",
			"commands/old.js": "old",
			"commands/tuned.js": "tuned",
		});
		const two = remote.next({
			"index.js": "two()",
			"config.json": "two",
		});
		const deploy = (env: Record<string, string>, deployment: string) => {
			return launch({
				...remote.env,
				...env,
				SERVERK_DEPLOYMENT_ID: deployment,
			});
		};

		expect(
			deploy(
				{
					SERVERK_REPO_REF: remote.sha,
				},
				"dep_1",
			).code,
		).toBe(0);

		writeRuntime();
		writeFileSync(join(app, "config.json"), "edited");
		writeFileSync(join(app, "commands", "tuned.js"), "mine");

		const second = deploy(
			{
				SERVERK_REPO_REF: two,
			},
			"dep_2",
		);

		expect(second.code).toBe(0);
		expect(second.lines).toContain(REMOVED_ONE);
		expect(second.lines).toContain(KEPT_ONE);
		expect(existsSync(join(app, "commands", "old.js"))).toBe(false);
		expect(readFileSync(join(app, "commands", "tuned.js"), "utf8")).toBe("mine");
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("two()");
		expect(readFileSync(join(app, "config.json"), "utf8")).toBe("two");
		expect(recorded()).toEqual([
			"config.json",
			"index.js",
		]);
		expectRuntimeKept();

		writeFileSync(join(app, "config.json"), "edited");

		const rollback = deploy(
			{
				SERVERK_REPO_REF: remote.sha,
			},
			"dep_3",
		);

		expect(rollback.code).toBe(0);
		expect(rollback.lines.some((line) => line.startsWith("serverk: removed"))).toBe(false);
		expect(readFileSync(join(app, "commands", "old.js"), "utf8")).toBe("old");
		expect(readFileSync(join(app, "commands", "tuned.js"), "utf8")).toBe("tuned");
		expect(readFileSync(join(app, "config.json"), "utf8")).toBe("one");
		expectRuntimeKept();

		const pull = deploy(
			{
				SERVERK_REPO_BRANCH: "main",
			},
			"dep_4",
		);

		expect(pull.lines).toContain(REMOVED_TWO);
		expect(stamp()).toMatchObject({
			deployment: "dep_4",
			commit: two,
			outcome: "ready",
		});
		expect(existsSync(join(app, "commands"))).toBe(false);
		expectRuntimeKept();
	});

	it("lets a snapshot's folder replace a file the author changed at its path, and its file replace a folder", () => {
		place(
			zipOf("one", {
				"index.js": "one()",
				extras: "file",
			}),
			"snap_1",
		);
		launch({
			SERVERK_SNAPSHOT_ID: "snap_1",
			SERVERK_DEPLOYMENT_ID: "dep_1",
		});
		writeRuntime();
		writeFileSync(join(app, "extras"), "mine");
		place(
			zipOf("two", {
				"index.js": "two()",
				"extras/a.js": "a",
			}),
			"snap_2",
		);

		const second = launch({
			SERVERK_SNAPSHOT_ID: "snap_2",
			SERVERK_DEPLOYMENT_ID: "dep_2",
		});

		expect(second.code).toBe(0);
		expect(second.lines).toContain(IN_THE_WAY_ONE);
		expect(second.lines.some((line) => line.startsWith("serverk: kept"))).toBe(false);
		expect(readFileSync(join(app, "extras", "a.js"), "utf8")).toBe("a");
		expect(recorded()).toEqual([
			"extras/a.js",
			"index.js",
		]);

		writeFileSync(join(app, "extras", "a.js"), "mine");
		place(
			zipOf("three", {
				"index.js": "three()",
				extras: "file again",
			}),
			"snap_3",
		);

		const third = launch({
			SERVERK_SNAPSHOT_ID: "snap_3",
			SERVERK_DEPLOYMENT_ID: "dep_3",
		});

		expect(third.code).toBe(0);
		expect(third.lines).toContain(IN_THE_WAY_ONE);
		expect(readFileSync(join(app, "extras"), "utf8")).toBe("file again");
		expectRuntimeKept();
	});

	it("lets a commit's folder replace a file the author changed at its path", () => {
		const remote = gitRemote({
			"index.js": "one()",
			extras: "file",
		});
		const two = remote.next({
			"index.js": "two()",
			"extras/a.js": "a",
		});

		expect(
			launch({
				...remote.env,
				SERVERK_REPO_REF: remote.sha,
				SERVERK_DEPLOYMENT_ID: "dep_1",
			}).code,
		).toBe(0);

		writeRuntime();
		writeFileSync(join(app, "extras"), "mine");

		const second = launch({
			...remote.env,
			SERVERK_REPO_REF: two,
			SERVERK_DEPLOYMENT_ID: "dep_2",
		});

		expect(second.code).toBe(0);
		expect(second.lines).toContain(IN_THE_WAY_ONE);
		expect(second.lines.some((line) => line.startsWith("serverk: kept"))).toBe(false);
		expect(readFileSync(join(app, "extras", "a.js"), "utf8")).toBe("a");
		expect(recorded()).toEqual([
			"extras/a.js",
			"index.js",
		]);
		expectRuntimeKept();
	});

	it("drops what the last deployment wrote after a restore lost the history, and after the .git folder was deleted", () => {
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
		writeRuntime();

		expect(recorded()).toEqual([
			"index.js",
			"lib/old.js",
		]);

		loseHistory();
		place(
			zipOf("two", {
				"index.js": "two()",
				"extra.js": "extra",
			}),
			"snap_2",
		);

		const second = launch({
			SERVERK_SNAPSHOT_ID: "snap_2",
			SERVERK_DEPLOYMENT_ID: "dep_2",
		});

		expect(second.code).toBe(0);
		expect(second.lines).toContain(REMOVED_ONE);
		expect(existsSync(join(app, "lib"))).toBe(false);
		expect(recorded()).toEqual([
			"extra.js",
			"index.js",
		]);
		expectRuntimeKept();

		loseHistory();

		const remote = gitRemote({
			"index.js": "git()",
			"config.json": "one",
		});
		const third = launch({
			...remote.env,
			SERVERK_REPO_REF: remote.sha,
			SERVERK_DEPLOYMENT_ID: "dep_3",
		});

		expect(third.code).toBe(0);
		expect(third.lines).toContain(REMOVED_ONE);
		expect(existsSync(join(app, "extra.js"))).toBe(false);
		expect(recorded()).toEqual([
			"config.json",
			"index.js",
		]);
		expectRuntimeKept();

		rmSync(join(app, ".git"), {
			force: true,
			recursive: true,
		});

		const fourth = launch({
			...remote.env,
			SERVERK_REPO_REF: remote.next({
				"index.js": "git2()",
			}),
			SERVERK_DEPLOYMENT_ID: "dep_4",
		});

		expect(fourth.code).toBe(0);
		expect(fourth.lines).toContain(REMOVED_ONE);
		expect(existsSync(join(app, "config.json"))).toBe(false);
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("git2()");
		expect(recorded()).toEqual([
			"index.js",
		]);
		expectRuntimeKept();
	});

	it("runs an uploaded snapshot from its root directory, not beside the sibling files", () => {
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

	it("fails the source stage on a missing root, and refuses a root that is not a plain folder path", () => {
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

	it("reinstalls when the root directory changes", () => {
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

	it("runs a start command that sets a variable before the program", () => {
		writeFileSync(join(app, "index.js"), "console.log('env ' + process.env.NODE_ENV)");

		const { code, lines } = launch({
			SERVERK_START_COMMAND: "NODE_ENV=production node index.js",
		});

		expect(code).toBe(0);
		expect(lines).toContain("serverk: start command: sh -c exec env NODE_ENV=production node index.js");
		expect(lines.at(-1)).toBe("env production");
	});

	it("installs and starts with the commands serverk.json declares", () => {
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

	it("builds after the install on a deployment and skips the build on a plain restart", () => {
		writeFileSync(join(app, "package.json"), JSON.stringify(BUILD_SCRIPT));
		writeFileSync(
			join(app, "serverk.json"),
			JSON.stringify({
				install: "echo declared install",
				build: "echo declared build",
			}),
		);
		writeFileSync(
			join(state, DEPLOY_MARKER),
			JSON.stringify({
				deployment: null,
				ref: null,
				snapshot: null,
				reinstall: false,
			}),
		);

		const deployed = launch({});

		expect(deployed.code).toBe(0);
		expect(
			deployed.lines.slice(
				deployed.lines.indexOf("serverk: dependencies installed"),
				deployed.lines.indexOf(READY_LINE) + 1,
			),
		).toEqual([
			"serverk: dependencies installed",
			"serverk: building: echo declared build",
			"declared build",
			"serverk: build finished",
			"serverk: start command: sh -c exec echo the bot ran",
			READY_LINE,
		]);

		const restart = launch({});

		expect(restart.code).toBe(0);
		expect(restart.lines).toContain("serverk: dependencies are up to date (custom)");
		expect(restart.lines).toContain("serverk: no new deployment or install, skipping the build");
		expect(restart.lines).not.toContain("declared build");
	});

	it("builds again on a restart that reinstalled, and in the start that follows an install-mode install", () => {
		writeFileSync(
			join(app, "serverk.json"),
			JSON.stringify({
				build: "echo declared build",
			}),
		);

		const installed = launch({
			SERVERK_INSTALL_COMMAND: "echo first install",
		});

		expect(installed.lines).toContain("serverk: installing dependencies: echo first install");
		expect(installed.lines).toContain("declared build");

		const reinstalled = launch({
			SERVERK_INSTALL_COMMAND: "echo second install",
		});

		expect(reinstalled.lines).toContain("serverk: installing dependencies: echo second install");
		expect(reinstalled.lines).toContain("serverk: building: echo declared build");
		expect(
			launch({
				SERVERK_INSTALL_COMMAND: "echo second install",
			}).lines,
		).toContain("serverk: no new deployment or install, skipping the build");

		const installMode = launch(
			{
				SERVERK_INSTALL_COMMAND: "echo third install",
			},
			[
				"install",
			],
		);

		expect(installMode.code).toBe(0);
		expect(installMode.lines).toContain("serverk: installing dependencies: echo third install");
		expect(
			installMode.lines.some((line) => line.startsWith("serverk: building:") || line.includes("skipping the build")),
		).toBe(false);
		expect(installMode.lines).not.toContain("declared build");

		const started = launch({
			SERVERK_INSTALL_COMMAND: "echo third install",
		});

		expect(started.lines).toContain("serverk: dependencies are up to date (custom)");
		expect(started.lines).toContain("declared build");
	});

	it("never builds after a failed install", () => {
		writeFileSync(
			join(app, "serverk.json"),
			JSON.stringify({
				install: "echo nope >&2; exit 3",
				build: "echo declared build",
			}),
		);

		const { code, lines } = launch({
			SERVERK_DEPLOYMENT_ID: "dep_i",
		});

		expect(code).toBe(1);
		expect(lines.at(-1)).toBe("serverk: deployment dep_i failed: install: nope");
		expect(lines.some((line) => line.startsWith("serverk: building:"))).toBe(false);
		expect(lines).not.toContain("declared build");
	});

	it("runs the cached package manager as CommonJS under a customer package.json of type module", () => {
		writeFileSync(
			join(app, "package.json"),
			JSON.stringify({
				type: "module",
			}),
		);
		mkdirSync(join(state, "cache", "corepack"), {
			recursive: true,
		});
		writeFileSync(join(state, "cache", "corepack", "yarn.js"), "console.log('require is a ' + typeof require)");

		const { code, lines } = launch({
			SERVERK_INSTALL_COMMAND: `cat ${join(state, "cache", "package.json")}; echo; node ${join(state, "cache", "corepack", "yarn.js")}`,
		});

		expect(code).toBe(0);
		expect(lines).toContain(CACHE_MANIFEST);
		expect(lines).toContain("require is a function");
	});

	it("sets CI for the install and the build, never for the bot", () => {
		writeFileSync(join(app, "index.js"), "console.log('bot ci ' + (process.env.CI ?? 'none'))");
		writeFileSync(
			join(app, "serverk.json"),
			JSON.stringify({
				install: "echo install ci $CI",
				build: "echo build ci $CI",
			}),
		);

		const { code, lines } = launch({
			SERVERK_DEPLOYMENT_ID: "dep_ci",
			SERVERK_START_COMMAND: "node index.js",
		});

		expect(code).toBe(0);
		expect(lines).toContain("install ci true");
		expect(lines).toContain("build ci true");
		expect(lines.at(-1)).toBe("bot ci none");
	});

	it("reinstalls when only the install command changes, from unlocked to locked", () => {
		const bin = join(root, "corepack-bin");

		mkdirSync(bin, {
			recursive: true,
		});
		writeFileSync(join(bin, "corepack"), '#!/bin/sh\necho "corepack ran $*"\n', {
			mode: 0o755,
		});
		writeFileSync(join(app, "package.json"), '{"name": "berry"}');
		writeFileSync(join(app, ".yarnrc.yml"), "nodeLinker: node-modules\n");

		const install = () => {
			return launch({
				PATH: `${bin}:${process.env.PATH ?? "/usr/bin:/bin"}`,
			}).lines;
		};

		expect(install()).toContain("serverk: installing dependencies: corepack yarn install --no-immutable");
		expect(install()).toContain("serverk: dependencies are up to date (yarn-berry)");

		writeFileSync(join(app, "yarn.lock"), "");

		expect(install()).toContain("serverk: installing dependencies: corepack yarn install --immutable");
		expect(install()).toContain("serverk: dependencies are up to date (yarn-berry)");
	});

	it("fails the build stage with the build's reason and the hint, and records the stage", () => {
		writeFileSync(
			join(app, "serverk.json"),
			JSON.stringify({
				build: "echo cannot find module discord.js >&2; exit 2",
			}),
		);

		const { code, lines } = launch({
			SERVERK_DEPLOYMENT_ID: "dep_b",
		});

		expect(code).toBe(1);
		expect(lines).toContain("serverk: building: echo cannot find module discord.js >&2; exit 2");
		expect(lines.some((line) => line.includes("تعذّر بناء كود بوتك"))).toBe(true);
		expect(lines.at(-1)).toBe("serverk: deployment dep_b failed: build: cannot find module discord.js");
		expect(DEPLOYMENT_LINE.exec(lines.at(-1) ?? "")?.groups?.stage).toBe("build");
		expect(JSON.parse(readFileSync(join(state, DEPLOYMENT_STAMP), "utf8"))).toMatchObject({
			deployment: "dep_b",
			outcome: "failed",
			stage: "build",
			detail: "cannot find module discord.js",
		});
	});

	it("says when the code asks for a Node version this runtime does not have, and carries on", () => {
		const major = Bun.spawnSync(
			[
				"node",
				"-p",
				"process.versions.node.split('.')[0]",
			],
			{
				stdout: "pipe",
			},
		)
			.stdout.toString()
			.trim();
		const asked = (packageJson: Record<string, unknown>, nvmrc: string | null) => {
			writeFileSync(join(app, "package.json"), JSON.stringify(packageJson));
			rmSync(join(app, ".nvmrc"), {
				force: true,
			});

			if (nvmrc !== null) {
				writeFileSync(join(app, ".nvmrc"), nvmrc);
			}

			const { code, lines } = launch({
				SERVERK_INSTALL_COMMAND: "echo custom install",
			});

			expect(code).toBe(0);
			expect(lines.at(-1)).toBe("the bot ran");

			return lines.filter((line) => line.startsWith("serverk: the code asks for Node"));
		};

		expect(
			asked(
				{
					engines: {
						node: "^16",
					},
				},
				"22",
			),
		).toEqual([
			`serverk: the code asks for Node 16, this runtime is Node ${major}`,
		]);
		expect(asked({}, "v16.20.2\n")).toEqual([
			`serverk: the code asks for Node 16, this runtime is Node ${major}`,
		]);
		expect(
			asked(
				{
					engines: {
						node: ">=16",
					},
				},
				"16",
			),
		).toEqual([]);
	});

	it("applies the customer's NODE_OPTIONS to the bot only, never to the launcher or the install", () => {
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

	it("boots uploaded code after a restore that dropped the history and the zips, and rebuilds the history later", () => {
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

	it("keeps the repository's code when the zip that replaces it is corrupt", () => {
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

	it("keeps the uploaded code when the repository that replaces it cannot be fetched", () => {
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
		expect(failed.lines.some((line) => line.includes("تعذّر سحب كود بوتك"))).toBe(true);
		expect(failed.lines.join("\n")).not.toContain("ghs_expired_token");
		expect(readFileSync(join(app, "index.js"), "utf8")).toBe("one()");
		expect(existsSync(join(state, HISTORY_DIR))).toBe(true);
		expect(existsSync(join(app, ".git"))).toBe(false);
	});

	it("pulls a branch with no pinned commit, then starts the last pulled code when the pull fails", () => {
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

	it("names a deleted commit only when the repository answers without it", () => {
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
		expect(failed.lines.some((line) => line.includes("الـ commit المطلوب نشره غير موجود"))).toBe(true);
	});

	it("refuses a repository that tracks .serverk instead of letting it overwrite the stamps", () => {
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

	it("installs and starts with no git token left in the launcher's own environment", () => {
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
		expect(stagesOf(lines)).toEqual([
			bridgeStageLine("dep_1", BotDeploymentStage.Sync),
			bridgeStageLine("dep_1", BotDeploymentStage.Install),
			bridgeStageLine("dep_1", BotDeploymentStage.Start),
		]);
		expect(stamp()).toMatchObject({
			deployment: "dep_1",
			outcome: "ready",
			commit: remote.sha,
		});
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
				"\trun)",
				'\t\techo "npm run $2 ran"',
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

	it("fails the install stage with npm's reason, not the path of its debug log", () => {
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

	it("drops a shipped lockfile with its snapshot and installs the next snapshot with npm install", () => {
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
		expect(stamp()).toMatchObject({
			deployment: "dep_snap_b",
			outcome: "ready",
		});
		expect(second.lines.at(-1)).toBe("the bot ran");
	});

	it("installs with npm install when the next snapshot ships no lockfile, over the one npm generated before", () => {
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
		expect(stamp()).toMatchObject({
			deployment: "dep_snap_b",
			outcome: "ready",
		});
		expect(second.lines.at(-1)).toBe("the bot ran");

		const restart = launch({
			PATH: fakeNpmPath(),
			SERVERK_SNAPSHOT_ID: "snap_b",
			SERVERK_DEPLOYMENT_ID: "dep_snap_b",
		});

		expect(restart.code).toBe(0);
		expect(restart.lines).toContain("serverk: dependencies are up to date (npm)");
	});

	it("installs a repository with npm install after a snapshot whose install generated a lockfile", () => {
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
		expect(stamp()).toMatchObject({
			deployment: "dep_git",
			outcome: "ready",
			commit: remote.sha,
		});
	});

	it("builds a snapshot with npm run build after npm ci", () => {
		const built = deployWithNpm("snap_a", {
			"package.json": JSON.stringify(BUILD_SCRIPT),
			"package-lock.json": '{"from-source": true}',
		});

		expect(built.code).toBe(0);
		expect(built.lines).toContain("serverk: installing dependencies: npm ci");
		expect(built.lines).toContain("serverk: building: npm run build");
		expect(built.lines).toContain("npm run build ran");
		expect(stamp()).toMatchObject({
			deployment: "dep_snap_a",
			outcome: "ready",
		});
	});

	it("keeps only the current snapshot and the ten before it, and drops stale zips", () => {
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
