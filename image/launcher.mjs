import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

export const READY_LINE = "serverk: bot process starting";

export const EXIT_FAILURE = 1;

export const EXIT_CONFIG = 78;

export const SYNC_MAX_AGE_MS = 600_000;

export const DEFAULT_STATE_DIR = "/home/container/.serverk";

export const DEFAULT_BRANCH = "main";

export const GIT_ASKPASS = "/serverk/git-askpass";

export const DETECT_TABLE_PATH = "/serverk/detect.json";

export const DETECT_TABLE_VERSION = 1;

export const REPO_URL_PATTERN = /^https:\/\/[^\s@/]+\/\S+$/;

export const REPO_BRANCH_PATTERN =
	/^(?!HEAD$)(?!.*(?:\.\.|\/\/|\/\.|\.lock(?:\/|$)|[/.]$))[A-Za-z0-9_][A-Za-z0-9._/-]{0,127}$/;

export const REPO_REF_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const ROOT_DIRECTORY_PATTERN =
	/^(?![./])(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)[A-Za-z0-9._\-/]*[A-Za-z0-9._-]$/;

export const ROOT_DIRECTORY_LENGTH_LIMIT = 255;

export const LAUNCHER_KEYS = [
	"SERVERK_REPO_URL",
	"SERVERK_REPO_REF",
	"SERVERK_REPO_BRANCH",
	"SERVERK_GIT_TOKEN",
	"SERVERK_START_COMMAND",
	"SERVERK_INSTALL_COMMAND",
	"SERVERK_ROOT_DIRECTORY",
	"SERVERK_DEPLOYMENT_ID",
	"SERVERK_SNAPSHOT_ID",
	"SERVERK_STATE_DIR",
	"SERVERK_DETECT_TABLE",
	"SERVERK_NODE_OPTIONS",
	"SERVERK_LAUNCH_RESUME",
];

export const NODE_OPTIONS_KEY = "SERVERK_NODE_OPTIONS";

export const RESUME_KEY = "SERVERK_LAUNCH_RESUME";

export const BUILT_IN_TABLE = {
	version: DETECT_TABLE_VERSION,
	procfile: {
		file: "Procfile",
		line: "^(worker|bot)\\s*:\\s*(.+)$",
		processes: [
			"worker",
			"bot",
		],
	},
	serverkJson: {
		file: "serverk.json",
		commandLengthLimit: 1024,
		runtimes: [
			"node",
			"python",
		],
		platforms: [
			"discord",
			"telegram",
		],
		frameworks: [
			"discord-js",
			"eris",
			"oceanic-js",
			"grammy",
			"telegraf",
			"node-telegram-bot-api",
			"discord-py",
			"py-cord",
			"nextcord",
			"disnake",
			"hikari",
			"python-telegram-bot",
			"aiogram",
			"pyrogram",
			"telethon",
		],
		envLimit: 100,
		envKey: "^[A-Za-z_][A-Za-z0-9_]*$",
		envKeyLengthLimit: 64,
		exampleLengthLimit: 256,
	},
	node: {
		manifest: "package.json",
		startFiles: [
			"index.js",
			"src/index.js",
			"bot.js",
			"src/bot.js",
			"index.ts",
		],
		lockfiles: [
			{
				file: "package-lock.json",
				manager: "npm",
			},
			{
				file: "npm-shrinkwrap.json",
				manager: "npm",
			},
			{
				file: "pnpm-lock.yaml",
				manager: "pnpm",
			},
			{
				file: "yarn.lock",
				manager: "yarn",
			},
		],
		installCommands: {
			npm: [
				"npm",
				"ci",
			],
			pnpm: [
				"corepack",
				"pnpm",
				"install",
				"--frozen-lockfile",
			],
			yarn: [
				"corepack",
				"yarn",
				"install",
			],
			"npm-install": [
				"npm",
				"install",
			],
		},
		unlockedManager: "npm-install",
	},
};

export const DEPLOY_MARKER = "deploy-requested";

export const LEGACY_REINSTALL_MARKER = "reinstall-requested";

export const DEPS_STAMP = "deps.json";

export const SYNC_STAMP = "sync.json";

export const DEPLOYMENT_STAMP = "deployment.json";

export const SNAPSHOTS_DIR = "snapshots";

export const HISTORY_DIR = "history";

export const SNAPSHOT_MAX_BYTES = 64 * 1024 * 1024;

export const SNAPSHOT_EXPANDED_MAX_BYTES = 512 * 1024 * 1024;

export const SNAPSHOT_ENTRY_LIMIT = 20_000;

export const HISTORY_KEEP = 10;

export const SNAPSHOT_STALE_MS = 15 * 60 * 1000;

export const PARTIAL_SUFFIX = ".partial";

export const Stage = {
	Sync: "sync",
	Snapshot: "snapshot",
	Install: "install",
	Start: "start",
};

export const Source = {
	Git: "git",
	Snapshot: "snapshot",
	Local: "local",
};

export const Outcome = {
	Ready: "ready",
	Failed: "failed",
};

const STATE_ENTRY = ".serverk";

const DEPENDENCY_ENTRIES = new Set([
	STATE_ENTRY,
	"node_modules",
	".venv",
	"__pycache__",
]);

const SHELL_OPERATORS = new Set([
	";",
	"&",
	"|",
	"(",
	")",
	"\n",
]);

const NO_EXEC_WORDS = new Set([
	".",
	":",
	"!",
	"[[",
	"{",
	"}",
	"alias",
	"bg",
	"break",
	"case",
	"cd",
	"command",
	"continue",
	"do",
	"done",
	"elif",
	"else",
	"esac",
	"eval",
	"exec",
	"exit",
	"export",
	"fg",
	"fi",
	"for",
	"function",
	"getopts",
	"hash",
	"if",
	"jobs",
	"local",
	"read",
	"readonly",
	"return",
	"select",
	"set",
	"shift",
	"source",
	"then",
	"times",
	"trap",
	"type",
	"typeset",
	"ulimit",
	"umask",
	"unalias",
	"unset",
	"until",
	"wait",
	"while",
]);

const ASSIGNMENT_WORD = /^[A-Za-z_][A-Za-z0-9_]*=/;

const GIT_HARDENING = [
	"-c",
	"core.hooksPath=/dev/null",
	"-c",
	"core.fsmonitor=false",
	"-c",
	"protocol.allow=never",
	"-c",
	"protocol.https.allow=always",
];

const GIT_CONFIG =
	"[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = false\n";

const GIT_ENVIRONMENT_KEYS = [
	"PATH",
	"HOME",
	"TZ",
	"LANG",
	"LC_ALL",
	"LC_CTYPE",
];

const STATE_TRACKED = "repository tracks .serverk";

const DETAIL_LIMIT = 200;

const COMMIT_LENGTH = 12;

const REDACTED = "***";

const HISTORY_IDENTITY = [
	"-c",
	"user.name=Serverk",
	"-c",
	"user.email=deploy@serverk.gg",
	"-c",
	"commit.gpgsign=false",
];

const SNAPSHOT_SCRIPT = `
import json, os, stat, sys, zipfile, zlib

def refuse(message):
    print(json.dumps({"error": message}))
    sys.exit(0)

def plan(bundle, max_entries, max_bytes):
    files = [info for info in bundle.infolist() if not info.is_dir()]
    kept = []
    for info in files:
        raw = info.filename
        segments = raw.split("/")
        if segments[0] == "__MACOSX" or ".git" in segments or segments[-1] == ".DS_Store":
            continue
        kept.append((info, raw))
    names = [raw for _, raw in kept]
    first = {name.split("/")[0] for name in names}
    wrapper = ""
    if len(first) == 1 and names and all("/" in name for name in names):
        wrapper = next(iter(first)) + "/"
    entries = []
    total = 0
    if len(kept) > max_entries:
        refuse(f"the archive holds more than {max_entries} files")
    for info, raw in kept:
        name = raw[len(wrapper):]
        segments = name.split("/")
        if segments[0] == ".serverk":
            continue
        if raw.startswith("/") or "\\\\" in raw or "\\0" in raw or any(part in ("", ".", "..") for part in segments):
            refuse(f"the archive entry {raw!r} is not a plain relative path")
        if stat.S_ISLNK(info.external_attr >> 16):
            refuse(f"the archive entry {raw!r} is a symlink")
        total += info.file_size
        if total > max_bytes:
            refuse(f"the archive expands past {max_bytes} bytes")
        entries.append((info, name))
    return entries

def extract(bundle, entries, destination):
    for info, name in entries:
        target = os.path.join(destination, name)
        parent = os.path.dirname(target)
        os.makedirs(parent, exist_ok=True)
        if os.path.islink(target):
            os.unlink(target)
        with bundle.open(info) as source, open(target, "wb") as sink:
            while True:
                chunk = source.read(1048576)
                if not chunk:
                    break
                sink.write(chunk)
        os.chmod(target, 0o755 if (info.external_attr >> 16) & 0o111 else 0o644)

mode, archive, destination, max_entries, max_bytes = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
try:
    with zipfile.ZipFile(archive) as bundle:
        entries = plan(bundle, max_entries, max_bytes)
        if mode == "extract":
            extract(bundle, entries, destination)
        else:
            broken = bundle.testzip()
            if broken is not None:
                refuse(f"the archive entry {broken!r} is corrupt")
        print(json.dumps({"files": [name for _, name in entries]}))
except (zipfile.BadZipFile, zlib.error, OSError, RuntimeError, ValueError, EOFError) as error:
    refuse(str(error))
`;

const SYNC_HINT =
	"تعذّر سحب كود بوتك من الريبو. تأكد من وجود الريبو والفرع، وإذا كان الريبو خاصًا فتأكد أن تطبيق سيرفرك على GitHub لديه صلاحية الوصول إليه.";

const PINNED_HINT = "الكوميت المطلوب نشره غير موجود في الريبو، وقد يكون حُذف من الفرع. انشر من جديد من آخر كوميت.";

const TRACKED_STATE_HINT =
	"يحتوي الريبو على مجلد .serverk، وهذا الاسم محجوز لمنصة سيرفرك. احذف المجلد من الريبو وانشر من جديد.";

const LINK_HINT =
	"رابط الريبو أو اسم الفرع غير صحيح. استخدم رابط https كاملًا دون اسم مستخدم أو كلمة مرور، واسم فرع Git صحيحًا.";

const REQUEST_HINT = "طلب النشر ناقص أو غير صحيح. انشر من جديد من صفحة البوت.";

const OCCUPIED_HINT =
	"يحتوي مجلد بوتك على ملفات ليست من ريبو Git، ولذلك تعذّر سحب الريبو فوقها. احذف الملفات من مدير الملفات وانشر من جديد.";

const SNAPSHOT_MISSING_HINT = "نسخة الكود المطلوب نشرها غير موجودة. ارفعها من جديد ثم انشر.";

const SNAPSHOT_BROKEN_HINT = "تعذّر فك ضغط ملف الكود المرفوع. تأكد أنه ملف zip سليم وارفعه من جديد.";

const ROOT_HINT = "مجلد الكود المحدد غير موجود داخل ملفات بوتك. تأكد من اسم المجلد في إعدادات البوت وانشر من جديد.";

const INSTALL_HINT = "تعذّر تثبيت مكتبات بوتك. راجع السطور السابقة في الكونسول، ثم صحّح package.json وانشر من جديد.";

const START_HINT =
	"لم نجد طريقة لتشغيل بوتك. أضف start إلى package.json أو ملف index.js، أو اضبط أمر التشغيل من إعدادات البوت.";

export class LaunchFailure extends Error {
	constructor(stage, arabic, english, detail, code = EXIT_FAILURE) {
		super(english);

		this.name = "LaunchFailure";
		this.stage = stage;
		this.arabic = arabic;
		this.english = english;
		this.detail = detail;
		this.code = code;
	}
}

export const say = (line) => {
	process.stdout.write(`serverk: ${line}\n`);
};

const text = (value) => {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();

	return trimmed.length === 0 ? null : trimmed;
};

export const shortCommit = (commit) => {
	return commit ? commit.slice(0, COMMIT_LENGTH) : null;
};

export const oneLine = (detail) => {
	const line = Array.from(
		String(detail ?? "")
			.replace(/\s+/g, " ")
			.trim(),
	)
		.slice(0, DETAIL_LIMIT)
		.join("");

	return line.length === 0 ? "no detail" : line;
};

export const deploymentLine = (deployment, outcome, details = {}) => {
	if (outcome === Outcome.Ready) {
		const commit = shortCommit(details.commit ?? null);

		return `serverk: deployment ${deployment} ready${commit ? ` at ${commit}` : ""}`;
	}

	return `serverk: deployment ${deployment} failed: ${details.stage}: ${oneLine(details.detail)}`;
};

export const botEnvironment = (environment) => {
	const clean = {
		...environment,
	};

	for (const key of LAUNCHER_KEYS) {
		delete clean[key];
	}

	return clean;
};

const readText = (path) => {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return null;
	}
};

const parseObject = (raw) => {
	if (raw === null) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw);

		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

const readJson = (path) => {
	return parseObject(readText(path));
};

const writeJson = (path, value) => {
	writeFileSync(path, `${JSON.stringify(value, null, "\t")}\n`);
};

const stringList = (value) => {
	return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : null;
};

const compiles = (pattern) => {
	try {
		new RegExp(pattern);

		return true;
	} catch {
		return false;
	}
};

const serverkJsonRulesOf = (rules) => {
	const limits = [
		rules?.commandLengthLimit,
		rules?.envLimit,
		rules?.envKeyLengthLimit,
		rules?.exampleLengthLimit,
	];

	if (
		typeof rules !== "object"
		|| rules === null
		|| typeof rules.file !== "string"
		|| !limits.every((limit) => Number.isSafeInteger(limit) && limit > 0)
		|| !stringList(rules.runtimes)
		|| !stringList(rules.platforms)
		|| !stringList(rules.frameworks)
		|| typeof rules.envKey !== "string"
		|| !compiles(rules.envKey)
	) {
		return null;
	}

	return {
		file: rules.file,
		commandLengthLimit: rules.commandLengthLimit,
		runtimes: rules.runtimes,
		platforms: rules.platforms,
		frameworks: rules.frameworks,
		envLimit: rules.envLimit,
		envKey: rules.envKey,
		envKeyLengthLimit: rules.envKeyLengthLimit,
		exampleLengthLimit: rules.exampleLengthLimit,
	};
};

export const tableOf = (raw) => {
	const table = parseObject(raw);
	const node = table?.node;
	const procfile = table?.procfile;
	const serverkJson = serverkJsonRulesOf(table?.serverkJson);

	if (
		table?.version !== DETECT_TABLE_VERSION
		|| typeof node !== "object"
		|| typeof procfile !== "object"
		|| serverkJson === null
	) {
		return null;
	}

	const lockfiles = Array.isArray(node.lockfiles)
		? node.lockfiles.filter((entry) => typeof entry?.file === "string" && typeof entry?.manager === "string")
		: [];
	const commands =
		typeof node.installCommands === "object" && node.installCommands !== null ? node.installCommands : {};

	if (
		typeof node.manifest !== "string"
		|| !stringList(node.startFiles)
		|| lockfiles.length === 0
		|| typeof node.unlockedManager !== "string"
		|| ![
			...lockfiles.map((entry) => entry.manager),
			node.unlockedManager,
		].every((manager) => stringList(commands[manager])?.length)
		|| typeof procfile.file !== "string"
		|| typeof procfile.line !== "string"
		|| !stringList(procfile.processes)
	) {
		return null;
	}

	return {
		version: DETECT_TABLE_VERSION,
		procfile: {
			file: procfile.file,
			line: procfile.line,
			processes: procfile.processes,
		},
		serverkJson,
		node: {
			manifest: node.manifest,
			startFiles: node.startFiles,
			lockfiles,
			installCommands: commands,
			unlockedManager: node.unlockedManager,
		},
	};
};

export const loadDetectTable = (env) => {
	return tableOf(readText(text(env.SERVERK_DETECT_TABLE) ?? DETECT_TABLE_PATH)) ?? BUILT_IN_TABLE;
};

export const hasShellOperator = (command) => {
	let quote = null;
	let escaped = false;

	for (const char of command) {
		if (escaped) {
			escaped = false;

			continue;
		}

		if (char === "\\" && quote !== "'") {
			escaped = true;

			continue;
		}

		if (quote) {
			if (char === quote) {
				quote = null;
			}

			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;

			continue;
		}

		if (SHELL_OPERATORS.has(char)) {
			return true;
		}
	}

	return false;
};

export const commandWords = (command) => {
	const words = [];

	let word = "";
	let quote = null;
	let escaped = false;
	let started = false;

	for (const char of command) {
		if (escaped) {
			word += char;
			escaped = false;

			continue;
		}

		if (char === "\\" && quote !== "'") {
			word += char;
			escaped = true;
			started = true;

			continue;
		}

		if (quote) {
			word += char;

			if (char === quote) {
				quote = null;
			}

			continue;
		}

		if (char === "'" || char === '"') {
			word += char;
			quote = char;
			started = true;

			continue;
		}

		if (/\s/.test(char)) {
			if (started) {
				words.push(word);
				word = "";
				started = false;
			}

			continue;
		}

		word += char;
		started = true;
	}

	if (started) {
		words.push(word);
	}

	return words;
};

export const shellCommand = (command) => {
	const shell = (script) => [
		"sh",
		"-c",
		script,
	];

	if (hasShellOperator(command)) {
		return shell(command);
	}

	const words = commandWords(command);
	const leading = words.findIndex((word) => !ASSIGNMENT_WORD.test(word));
	const program = leading === -1 ? null : words[leading];

	if (program === null || program === undefined || NO_EXEC_WORDS.has(program)) {
		return shell(command);
	}

	return shell(leading > 0 ? `exec env ${command}` : `exec ${command}`);
};

export const procfileCommand = (content, table = BUILT_IN_TABLE) => {
	const pattern = new RegExp(table.procfile.line);
	const entries = new Map();

	for (const line of content.split(/\r?\n/)) {
		const match = line.trim().match(pattern);

		if (match?.[1] && match[2] && !entries.has(match[1])) {
			entries.set(match[1], match[2].trim());
		}
	}

	for (const process of table.procfile.processes) {
		const command = entries.get(process);

		if (command) {
			return command;
		}
	}

	return null;
};

const codePointLength = (value) => {
	return Array.from(value).length;
};

const optionalChoice = (value, allowed) => {
	return value === undefined || value === null || (typeof value === "string" && allowed.includes(value));
};

const declaredCommand = (value, limit) => {
	if (value === undefined || value === null) {
		return {
			ok: true,
			value: null,
		};
	}

	const command = typeof value === "string" ? value.trim() : "";
	const ok = command.length > 0 && codePointLength(command) <= limit && !command.includes("\n");

	return {
		ok,
		value: ok ? command : null,
	};
};

const declaredEnvEntry = (entry, rules, envKey) => {
	const isKey = (key) => typeof key === "string" && key.length <= rules.envKeyLengthLimit && envKey.test(key);

	if (typeof entry === "string") {
		return isKey(entry);
	}

	if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
		return false;
	}

	const sensitive = entry.sensitive ?? null;
	const example = entry.example ?? null;

	return (
		isKey(entry.key)
		&& (sensitive === null || typeof sensitive === "boolean")
		&& (example === null || (typeof example === "string" && codePointLength(example) <= rules.exampleLengthLimit))
	);
};

export const serverkJsonOf = (raw, table = BUILT_IN_TABLE) => {
	const document = parseObject(raw);

	if (document === null) {
		return null;
	}

	const rules = table.serverkJson;
	const envKey = new RegExp(rules.envKey);
	const start = declaredCommand(document.start, rules.commandLengthLimit);
	const install = declaredCommand(document.install, rules.commandLengthLimit);
	const env = document.env;
	const envValid =
		env === undefined
		|| env === null
		|| (Array.isArray(env)
			&& env.length <= rules.envLimit
			&& env.every((entry) => declaredEnvEntry(entry, rules, envKey)));

	if (
		!optionalChoice(document.runtime, rules.runtimes)
		|| !optionalChoice(document.platform, rules.platforms)
		|| !optionalChoice(document.framework, rules.frameworks)
		|| !start.ok
		|| !install.ok
		|| !envValid
	) {
		return null;
	}

	return {
		start: start.value,
		install: install.value,
	};
};

export const relativeFile = (path) => {
	const file = normalize(path.trim()).replace(/\/+$/, "");

	return file.length === 0 || file === "." || file.startsWith("..") || file.startsWith("/") ? null : file;
};

export const startCandidates = (packageJson, table = BUILT_IN_TABLE) => {
	const main = typeof packageJson?.main === "string" ? relativeFile(packageJson.main) : null;

	return [
		...(main
			? [
					main,
				]
			: []),
		...table.node.startFiles,
	];
};

export const detectStart = (files, packageJson, options = {}, table = BUILT_IN_TABLE) => {
	const startCommand = options.startCommand?.trim();

	if (startCommand) {
		return {
			source: "start-command",
			argv: shellCommand(startCommand),
		};
	}

	const declared = options.serverkJson?.start ?? null;

	if (declared) {
		return {
			source: "serverk-json",
			argv: shellCommand(declared),
		};
	}

	const script = packageJson?.scripts?.start;

	if (typeof script === "string" && script.trim().length > 0) {
		return {
			source: "start-script",
			argv: shellCommand(script.trim()),
		};
	}

	const main = typeof packageJson?.main === "string" ? relativeFile(packageJson.main) : null;

	if (main && files.has(main)) {
		return {
			source: "main",
			argv: [
				"node",
				main,
			],
		};
	}

	const file = table.node.startFiles.find((candidate) => files.has(candidate));

	if (file) {
		return {
			source: "file",
			argv: [
				"node",
				file,
			],
		};
	}

	const procfile = options.procfile ? procfileCommand(options.procfile, table) : null;

	if (procfile) {
		return {
			source: "procfile",
			argv: shellCommand(procfile),
		};
	}

	return null;
};

export const detectManager = (files, table = BUILT_IN_TABLE) => {
	const locked = table.node.lockfiles.find((entry) => files.has(entry.file));

	if (locked) {
		return {
			manager: locked.manager,
			lockfile: locked.file,
		};
	}

	if (files.has(table.node.manifest)) {
		return {
			manager: table.node.unlockedManager,
			lockfile: null,
		};
	}

	return null;
};

export const dependencyHash = (parts) => {
	return createHash("sha256").update(parts.join("\0")).digest("hex");
};

export const dependenciesCurrent = (stamp, hash, modules) => {
	return stamp?.hash === hash && (stamp.modules ?? true) === modules;
};

export const syncDue = (stamp, request) => {
	if (request.deploy || !request.checkout || !stamp) {
		return true;
	}

	if (stamp.repo !== request.repo || stamp.branch !== request.branch) {
		return true;
	}

	const syncedAt = Date.parse(stamp.syncedAt ?? "");

	return !Number.isFinite(syncedAt) || request.now - syncedAt > SYNC_MAX_AGE_MS;
};

export const parseMarker = (raw) => {
	if (raw === null) {
		return null;
	}

	const marker = parseObject(raw);
	const valid = (value, pattern) => (typeof value === "string" && pattern.test(value) ? value : null);

	return {
		deployment: valid(marker?.deployment, ID_PATTERN),
		ref: valid(marker?.ref, REPO_REF_PATTERN),
		snapshot: valid(marker?.snapshot, ID_PATTERN),
		reinstall: marker?.reinstall === true,
	};
};

export const resolveRequest = (env, marker, legacyReinstall, stamp) => {
	const deployment = text(env.SERVERK_DEPLOYMENT_ID) ?? marker?.deployment ?? null;
	const implied = deployment !== null && (stamp?.deployment !== deployment || stamp.outcome !== Outcome.Ready);

	return {
		deployment,
		ref: text(env.SERVERK_REPO_REF) ?? marker?.ref ?? null,
		snapshot: text(env.SERVERK_SNAPSHOT_ID) ?? marker?.snapshot ?? null,
		reinstall: marker?.reinstall === true || legacyReinstall,
		deploying: marker !== null || legacyReinstall || implied,
	};
};

export const occupiedEntries = (entries) => {
	return entries.filter((entry) => !DEPENDENCY_ENTRIES.has(entry));
};

const isFile = (path) => {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
};

const isDirectory = (path) => {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
};

const takeMarker = (path) => {
	if (!existsSync(path)) {
		return null;
	}

	const raw = readText(path) ?? "";

	rmSync(path, {
		force: true,
	});

	return raw;
};

const redactor = (secret) => {
	return (line) => (secret ? line.split(secret).join(REDACTED) : line);
};

const NPM_NOISE = [
	/^npm (?:error|ERR!) A complete log of this run can be found in/,
	/^npm (?:error|ERR!)$/,
	/^npm (?:error|ERR!)\s+\S*_logs\/\S*\.log$/,
	/^npm notice\b/,
];

const NPM_CODE = /^npm (?:error|ERR!) code \S+$/;

const NPM_DESCRIBED = /^npm (?:error|ERR!) (?:404 \S|ERESOLVE\b)/;

const NPM_BARE_404 = /^npm (?:error|ERR!) 404$/;

const NPM_PREFIX = /^npm (?:error|ERR!) /;

export const createDetailPicker = () => {
	let code = null;
	let reason = null;
	let described = null;
	let last = null;

	return {
		add(line) {
			const text = line.trim();

			if (text.length === 0 || NPM_NOISE.some((pattern) => pattern.test(text))) {
				return;
			}

			last = text;

			if (code === null) {
				if (NPM_CODE.test(text)) {
					code = text;
				} else if (described === null && NPM_DESCRIBED.test(text)) {
					described = text;
				}

				return;
			}

			if (reason === null && !NPM_BARE_404.test(text)) {
				reason = text.replace(NPM_PREFIX, "");
			}
		},
		pick() {
			if (code !== null) {
				return reason === null ? code : `${code}: ${reason}`;
			}

			return described ?? last;
		},
	};
};

export const failureDetail = (lines) => {
	const picker = createDetailPicker();

	for (const line of lines) {
		picker.add(line);
	}

	return picker.pick();
};

const forward = (stream, target, redact, remember) => {
	let pending = "";

	const emit = (line) => {
		const shown = redact(line.replace(/\r$/, ""));

		target?.write(`${shown}\n`);
		remember(shown);
	};

	stream.setEncoding("utf8");

	stream.on("data", (chunk) => {
		pending += chunk;

		const lines = pending.split("\n");

		pending = lines.pop() ?? "";

		for (const line of lines) {
			emit(line);
		}
	});

	stream.on("end", () => {
		if (pending.length > 0) {
			emit(pending);
		}
	});
};

const run = (argv, options) => {
	const [program, ...args] = argv;
	const redact = redactor(options.secret ?? null);

	return new Promise((resolve) => {
		const errors = createDetailPicker();

		let lastOutput = null;
		let captured = "";

		const child = spawn(program, args, {
			cwd: options.cwd,
			env: options.env,
			stdio: [
				"ignore",
				"pipe",
				"pipe",
			],
		});

		const echo = options.echo !== false;

		if (options.capture) {
			child.stdout.setEncoding("utf8");
			child.stdout.on("data", (chunk) => {
				captured += chunk;
			});
		} else {
			forward(child.stdout, echo ? process.stdout : null, redact, (line) => {
				if (line.trim().length > 0) {
					lastOutput = line.trim();
				}
			});
		}

		forward(child.stderr, echo ? process.stderr : null, redact, (line) => {
			errors.add(line);
		});

		child.on("error", (error) => {
			resolve({
				code: 127,
				last: redact(error.message).slice(0, DETAIL_LIMIT),
				stdout: "",
			});
		});

		child.on("close", (code, signal) => {
			const detail = errors.pick() ?? lastOutput ?? `${program} exited with ${signal ?? `code ${code}`}`;

			resolve({
				code: code ?? 1,
				last: Array.from(detail).slice(0, DETAIL_LIMIT).join(""),
				stdout: options.capture ? captured : (lastOutput ?? ""),
			});
		});
	});
};

export const repoHost = (repo) => {
	return typeof repo === "string" && repo.startsWith("https://")
		? (repo.slice("https://".length).split("/")[0] ?? "")
		: "";
};

export const gitEnvironment = (env, gitToken, repo) => {
	const kept = Object.fromEntries(
		GIT_ENVIRONMENT_KEYS.filter((key) => typeof env[key] === "string").map((key) => [
			key,
			env[key],
		]),
	);

	return {
		...kept,
		GIT_CONFIG_GLOBAL: "/dev/null",
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_TERMINAL_PROMPT: "0",
		...(gitToken
			? {
					GIT_ASKPASS,
					SERVERK_GIT_TOKEN: gitToken,
					SERVERK_GIT_HOST: repoHost(repo),
				}
			: {}),
	};
};

export const gitArgv = (...args) => {
	return [
		"git",
		...GIT_HARDENING,
		...args,
	];
};

const writeGitConfig = (gitDir) => {
	writeFileSync(join(gitDir, "config"), GIT_CONFIG);
};

const headCommit = async (appDir, env, gitDir = null) => {
	const result = await run(
		gitArgv(
			...(gitDir
				? [
						`--git-dir=${gitDir}`,
					]
				: []),
			"rev-parse",
			"--verify",
			"--quiet",
			"HEAD",
		),
		{
			cwd: appDir,
			env,
			echo: false,
		},
	);

	return result.code === 0 && /^[0-9a-f]{40,64}$/.test(result.stdout) ? result.stdout : null;
};

const trackedFiles = async (appDir, env, gitDir) => {
	const result = await run(
		gitArgv(
			...(gitDir
				? [
						`--git-dir=${gitDir}`,
						`--work-tree=${appDir}`,
					]
				: []),
			"ls-files",
			"-z",
		),
		{
			cwd: appDir,
			env,
			echo: false,
			capture: true,
		},
	);

	return result.code === 0 ? result.stdout.split("\0").filter((file) => file.length > 0) : [];
};

const pruneEmptyParents = (appDir, directory) => {
	let current = directory;

	while (current !== appDir && current.startsWith(`${appDir}/`)) {
		try {
			rmdirSync(current);
		} catch {
			return;
		}

		current = dirname(current);
	}
};

const insideOf = (base, path) => {
	return path === base || path.startsWith(`${base}/`);
};

const removeFiles = (appDir, files) => {
	let base;

	try {
		base = realpathSync(appDir);
	} catch {
		return;
	}

	for (const file of files) {
		const path = join(appDir, file);

		if (!path.startsWith(`${appDir}/`)) {
			continue;
		}

		let parent;

		try {
			parent = realpathSync(dirname(path));
		} catch {
			continue;
		}

		if (!insideOf(base, parent)) {
			continue;
		}

		const target = join(parent, basename(path));

		try {
			if (lstatSync(target).isDirectory()) {
				continue;
			}
		} catch {
			continue;
		}

		rmSync(target, {
			force: true,
		});
		pruneEmptyParents(appDir, dirname(path));
	}
};

const leaveGitSource = async (context) => {
	const { appDir, env } = context;
	const gitDir = join(appDir, ".git");

	if (!isDirectory(gitDir)) {
		return;
	}

	say("switching from the repository to uploaded code");

	removeFiles(appDir, await trackedFiles(appDir, gitEnvironment(env, null, null), null));
	rmSync(gitDir, {
		force: true,
		recursive: true,
	});
};

const leaveSnapshotSource = async (context) => {
	const { appDir, stateDir, env } = context;
	const historyDir = join(stateDir, HISTORY_DIR);

	if (!isDirectory(historyDir)) {
		return;
	}

	say("switching from uploaded code to the repository");

	removeFiles(appDir, await trackedFiles(appDir, gitEnvironment(env, null, null), historyDir));
	rmSync(historyDir, {
		force: true,
		recursive: true,
	});
};

const excludeStateDirectory = (appDir) => {
	const exclude = join(appDir, ".git", "info", "exclude");
	const current = readText(exclude) ?? "";

	if (current.split("\n").includes(`/${STATE_ENTRY}/`)) {
		return;
	}

	mkdirSync(join(appDir, ".git", "info"), {
		recursive: true,
	});
	writeFileSync(exclude, `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}/${STATE_ENTRY}/\n`);
};

const managedSource = (stamp) => {
	return stamp?.source === Source.Git || stamp?.source === Source.Snapshot;
};

class SyncRefusal extends Error {
	constructor(message, arabic) {
		super(message);

		this.name = "SyncRefusal";
		this.arabic = arabic;
	}
}

const syncGit = async (context) => {
	const { appDir, stateDir, env, request } = context;
	const repo = text(env.SERVERK_REPO_URL);
	const branch = text(env.SERVERK_REPO_BRANCH) ?? DEFAULT_BRANCH;
	const ref = request.ref;

	if (!REPO_URL_PATTERN.test(repo) || !REPO_BRANCH_PATTERN.test(branch)) {
		throw new LaunchFailure(
			Stage.Sync,
			LINK_HINT,
			"sync failed: the repository link must be a full https link with no username or password, and the branch a valid Git branch name",
			"the repository link or branch is not valid",
			EXIT_CONFIG,
		);
	}

	if (ref !== null && !REPO_REF_PATTERN.test(ref)) {
		throw new LaunchFailure(
			Stage.Sync,
			REQUEST_HINT,
			"sync failed: the commit to deploy is not a full commit hash",
			"the commit is not a full hash",
			EXIT_CONFIG,
		);
	}

	const gitToken = text(env.SERVERK_GIT_TOKEN);
	const stampPath = join(stateDir, SYNC_STAMP);
	const stamp = readJson(stampPath);
	const gitDir = join(appDir, ".git");
	const checkout = isDirectory(gitDir);
	const gitEnv = gitEnvironment(env, gitToken, repo);

	if (checkout) {
		writeGitConfig(gitDir);
	}

	const before = checkout ? await headCommit(appDir, gitEnv) : null;

	if (ref !== null) {
		if (!request.deploying && checkout && stamp?.repo === repo && before === ref) {
			say(`code is at ${shortCommit(ref)}`);

			return {
				source: Source.Git,
				commit: before,
			};
		}
	} else if (
		!syncDue(stamp, {
			deploy: request.deploying,
			checkout,
			repo,
			branch,
			now: Date.now(),
		})
	) {
		say("code synced a moment ago, skipping the pull");

		return {
			source: Source.Git,
			commit: before,
		};
	}

	if (!checkout && !managedSource(stamp) && occupiedEntries(readdirSync(appDir)).length > 0) {
		throw new LaunchFailure(
			Stage.Sync,
			OCCUPIED_HINT,
			"sync failed: your bot folder already holds files that are not a Git checkout. Delete them and deploy again",
			"the bot folder holds files that are not a Git checkout",
			EXIT_CONFIG,
		);
	}

	const git = async (...args) => {
		const result = await run(gitArgv(...args), {
			cwd: appDir,
			env: gitEnv,
			secret: gitToken,
		});

		if (result.code !== 0) {
			throw new Error(result.last);
		}
	};

	const tracksState = async (treeish) => {
		const result = await run(gitArgv("ls-tree", "--name-only", treeish, "--", STATE_ENTRY), {
			cwd: appDir,
			env: gitEnv,
			echo: false,
			capture: true,
		});

		return result.code === 0 && result.stdout.trim().length > 0;
	};

	say(ref ? `fetching ${repo} at ${shortCommit(ref)}` : `pulling ${repo} (${branch})`);

	let created = false;

	try {
		if (!checkout) {
			await git("init", "--quiet", `--initial-branch=${branch}`);

			created = true;

			writeGitConfig(gitDir);
		}

		excludeStateDirectory(appDir);

		let target = "FETCH_HEAD";

		if (ref === null) {
			await git("fetch", "--quiet", "--no-tags", "--depth", "1", repo, branch);
		} else if (before === ref) {
			target = ref;
		} else {
			try {
				await git("fetch", "--quiet", "--no-tags", "--depth", "1", repo, ref);
			} catch (pinned) {
				await git("fetch", "--quiet", "--no-tags", "--depth", "1", repo, branch);

				if ((await headOf(appDir, gitEnv, "FETCH_HEAD")) !== ref) {
					throw new SyncRefusal(
						`commit ${shortCommit(ref)} is not in the repository (${oneLine(pinned instanceof Error ? pinned.message : pinned)})`,
						PINNED_HINT,
					);
				}
			}
		}

		if (await tracksState(target)) {
			throw new SyncRefusal(STATE_TRACKED, TRACKED_STATE_HINT);
		}

		await leaveSnapshotSource(context);

		if (ref === null) {
			await git("checkout", "--quiet", "--force", "-B", branch, "FETCH_HEAD");
		} else {
			await git("checkout", "--quiet", "--force", "--detach", target);

			const landed = await headCommit(appDir, gitEnv);

			if (landed !== ref) {
				throw new Error(`the checkout landed on ${shortCommit(landed) ?? "nothing"}, not ${shortCommit(ref)}`);
			}
		}
	} catch (error) {
		if (created) {
			rmSync(gitDir, {
				force: true,
				recursive: true,
			});
		}

		const detail = error instanceof Error ? error.message : String(error);

		if (error instanceof SyncRefusal) {
			throw new LaunchFailure(Stage.Sync, error.arabic, `sync failed: ${detail}`, detail);
		}

		if (ref === null && before) {
			say(`sync failed: ${detail}. Starting the last pulled code (${shortCommit(before)})`);

			return {
				source: Source.Git,
				commit: before,
			};
		}

		throw new LaunchFailure(Stage.Sync, SYNC_HINT, `sync failed: ${detail}`, detail);
	}

	const after = await headCommit(appDir, gitEnv);

	writeJson(stampPath, {
		source: Source.Git,
		repo,
		branch,
		ref,
		commit: after,
		syncedAt: new Date().toISOString(),
	});

	if (before && after && before !== after) {
		say(`updated ${shortCommit(before)} -> ${shortCommit(after)}`);
	} else {
		say(`code is at ${shortCommit(after) ?? "an unknown commit"}`);
	}

	return {
		source: Source.Git,
		commit: after,
	};
};

const headOf = async (appDir, env, name) => {
	const result = await run(gitArgv("rev-parse", "--verify", "--quiet", name), {
		cwd: appDir,
		env,
		echo: false,
	});

	return result.code === 0 ? result.stdout : null;
};

const snapshotFiles = async (mode, archive, appDir, env) => {
	const result = await run(
		[
			"python3",
			"-I",
			"-c",
			SNAPSHOT_SCRIPT,
			mode,
			archive,
			appDir,
			String(SNAPSHOT_ENTRY_LIMIT),
			String(SNAPSHOT_EXPANDED_MAX_BYTES),
		],
		{
			cwd: appDir,
			env: botEnvironment(env),
			echo: false,
		},
	);
	const answer = parseObject(result.stdout);

	if (result.code !== 0 || !answer) {
		throw new Error(result.last);
	}

	if (typeof answer.error === "string") {
		throw new Error(answer.error);
	}

	return stringList(answer.files) ?? [];
};

export const cleanSnapshots = (snapshotsDir, keep, now = Date.now()) => {
	let entries;

	try {
		entries = readdirSync(snapshotsDir);
	} catch {
		return;
	}

	const kept = keep
		? [
				`${keep}.zip`,
				`${keep}.zip${PARTIAL_SUFFIX}`,
			]
		: [];

	for (const entry of entries) {
		if (kept.includes(entry) || !(entry.endsWith(".zip") || entry.endsWith(`.zip${PARTIAL_SUFFIX}`))) {
			continue;
		}

		const path = join(snapshotsDir, entry);

		try {
			const info = lstatSync(path);

			if (!info.isFile() || now - info.mtimeMs < SNAPSHOT_STALE_MS) {
				continue;
			}
		} catch {
			continue;
		}

		rmSync(path, {
			force: true,
		});
	}
};

export const newestFirst = (records) => {
	return records
		.map((line) => {
			const [name = "", seconds = "", word = "", created = ""] = line.split(" ");
			const at = word === "created" && /^\d+$/.test(created) ? Number(created) : Number(seconds) * 1000;

			return {
				name,
				at: Number.isFinite(at) ? at : 0,
			};
		})
		.filter((record) => record.name.length > 0)
		.sort((a, b) => b.at - a.at || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
		.map((record) => record.name);
};

export const doomedTags = (snapshotTags, otherTags, current, keep = HISTORY_KEEP) => {
	const doomed = [];

	let others = 0;

	for (const name of snapshotTags) {
		if (name === current) {
			continue;
		}

		if (others < keep) {
			others += 1;

			continue;
		}

		doomed.push(name);
	}

	return [
		...doomed,
		...otherTags,
	];
};

const pruneHistory = async (history, current) => {
	const lines = (output) => {
		return output
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	};

	const snapshotTags = newestFirst(
		lines(
			await history(
				[
					"for-each-ref",
					"--format=%(refname:short) %(committerdate:unix) %(contents:body)",
					"refs/tags/snapshot-*",
				],
				true,
			),
		),
	);
	const otherTags = lines(
		await history(
			[
				"for-each-ref",
				"--format=%(refname:short)",
				"refs/tags/",
			],
			true,
		),
	).filter((name) => !name.startsWith("snapshot-"));
	const branches = lines(
		await history(
			[
				"for-each-ref",
				"--format=%(refname)",
				"refs/heads/",
			],
			true,
		),
	);
	const doomed = doomedTags(snapshotTags, otherTags, current);

	if (doomed.length > 0) {
		await history([
			"tag",
			"--delete",
			...doomed,
		]);
	}

	for (const branch of branches) {
		await history([
			"update-ref",
			"-d",
			branch,
		]);
	}

	await history([
		"reflog",
		"expire",
		"--expire=now",
		"--all",
	]);
	await history([
		"-c",
		"pack.threads=1",
		"-c",
		"pack.windowMemory=64m",
		"-c",
		"core.bigFileThreshold=16m",
		"gc",
		"--quiet",
		"--prune=now",
	]);
};

const syncSnapshot = async (context) => {
	const { appDir, stateDir, env, request } = context;
	const id = request.snapshot;

	if (!ID_PATTERN.test(id)) {
		throw new LaunchFailure(
			Stage.Snapshot,
			REQUEST_HINT,
			"snapshot failed: the snapshot id is not valid",
			"the snapshot id is not valid",
			EXIT_CONFIG,
		);
	}

	const historyDir = join(stateDir, HISTORY_DIR);
	const snapshotsDir = join(stateDir, SNAPSHOTS_DIR);
	const archive = join(snapshotsDir, `${id}.zip`);
	const stampPath = join(stateDir, SYNC_STAMP);
	const stamp = readJson(stampPath);
	const gitEnv = gitEnvironment(env, null, null);
	const tag = `snapshot-${id}`;

	const history = async (args, capture = false) => {
		const result = await run(
			gitArgv(`--git-dir=${historyDir}`, `--work-tree=${appDir}`, "--literal-pathspecs", ...HISTORY_IDENTITY, ...args),
			{
				cwd: appDir,
				env: gitEnv,
				echo: false,
				capture,
			},
		);

		if (result.code !== 0) {
			throw new Error(result.last);
		}

		return result.stdout;
	};

	const hasHistory = isDirectory(historyDir);

	if (hasHistory) {
		writeGitConfig(historyDir);
	}

	const tagged = async () => {
		if (!hasHistory) {
			return false;
		}

		try {
			await history([
				"rev-parse",
				"--verify",
				"--quiet",
				`refs/tags/${tag}`,
			]);

			return true;
		} catch {
			return false;
		}
	};

	const present = isFile(archive);
	const stamped = stamp?.source === Source.Snapshot && stamp.snapshot === id;

	if (!present && stamped && (!request.deploying || !(await tagged()))) {
		say(`code is at snapshot ${id}`);

		return {
			source: Source.Snapshot,
			commit: stamp.commit ?? null,
		};
	}

	const broken = (error) => {
		const detail = error instanceof Error ? error.message : String(error);

		return new LaunchFailure(Stage.Snapshot, SNAPSHOT_BROKEN_HINT, `snapshot failed: ${detail}`, detail);
	};

	let incoming = null;

	if (present) {
		try {
			if (statSync(archive).size > SNAPSHOT_MAX_BYTES) {
				throw new Error(`the archive is larger than ${SNAPSHOT_MAX_BYTES} bytes`);
			}

			incoming = new Set(await snapshotFiles("list", archive, appDir, env));
		} catch (error) {
			throw broken(error);
		}
	} else if (!(await tagged())) {
		throw new LaunchFailure(
			Stage.Snapshot,
			SNAPSHOT_MISSING_HINT,
			`snapshot failed: snapshot ${id} is not on this bot`,
			`snapshot ${id} is not on this bot`,
		);
	}

	await leaveGitSource(context);

	const message = request.deployment ? `deployment ${request.deployment}` : `snapshot ${id}`;

	try {
		if (!isDirectory(historyDir)) {
			await history([
				"init",
				"--quiet",
			]);
		}

		writeGitConfig(historyDir);

		if (incoming !== null) {
			say(`unpacking snapshot ${id}`);

			const previous = await trackedFiles(appDir, gitEnv, historyDir);

			removeFiles(
				appDir,
				previous.filter((file) => !incoming.has(file)),
			);

			const written = await snapshotFiles("extract", archive, appDir, env);
			const list = join(stateDir, "snapshot-files");

			writeFileSync(list, written.map((file) => `${file}\0`).join(""));

			try {
				await history([
					"read-tree",
					"--empty",
				]);

				if (written.length > 0) {
					await history([
						"add",
						"--force",
						`--pathspec-from-file=${list}`,
						"--pathspec-file-nul",
					]);
				}
			} finally {
				rmSync(list, {
					force: true,
				});
			}

			const tree = (
				await history(
					[
						"write-tree",
					],
					true,
				)
			).trim();
			const commit = (
				await history(
					[
						"commit-tree",
						"-m",
						message,
						"-m",
						`created ${Date.now()}`,
						tree,
					],
					true,
				)
			).trim();

			await history([
				"update-ref",
				"--no-deref",
				"HEAD",
				commit,
			]);
			await history([
				"tag",
				"--force",
				tag,
				commit,
			]);

			rmSync(archive, {
				force: true,
			});
		} else {
			say(`restoring snapshot ${id}`);

			await history([
				"checkout",
				"--quiet",
				"--force",
				"--detach",
				tag,
			]);
		}
	} catch (error) {
		throw broken(error);
	}

	try {
		await pruneHistory(history, tag);
	} catch (error) {
		say(`history cleanup skipped: ${oneLine(error instanceof Error ? error.message : error)}`);
	}

	const commit = await headCommit(appDir, gitEnv, historyDir);

	writeJson(stampPath, {
		source: Source.Snapshot,
		snapshot: id,
		commit,
		syncedAt: new Date().toISOString(),
	});

	say(`code is at snapshot ${id}`);

	return {
		source: Source.Snapshot,
		commit,
	};
};

const syncFrom = async (context) => {
	if (context.request.snapshot !== null) {
		return await syncSnapshot(context);
	}

	if (text(context.env.SERVERK_REPO_URL)) {
		return await syncGit(context);
	}

	say("no repository linked, running the files in your bot folder");

	return {
		source: Source.Local,
		commit: null,
	};
};

const syncSource = async (context) => {
	const synced = await syncFrom(context);

	if (context.request.deploying) {
		cleanSnapshots(join(context.stateDir, SNAPSHOTS_DIR), context.request.snapshot);
	}

	return synced;
};

export const isRootDirectory = (value) => {
	return value.length <= ROOT_DIRECTORY_LENGTH_LIMIT && ROOT_DIRECTORY_PATTERN.test(value);
};

export const sourceStage = (request) => {
	return request.snapshot !== null ? Stage.Snapshot : Stage.Sync;
};

export const resolveProjectDir = (appDir, root, stage) => {
	if (root === null) {
		return appDir;
	}

	const refuse = (detail) => {
		return new LaunchFailure(stage, ROOT_HINT, `${stage} failed: ${detail}`, detail, EXIT_CONFIG);
	};

	if (!isRootDirectory(root)) {
		throw refuse(`root directory ${root} is not valid`);
	}

	let resolved;

	try {
		resolved = realpathSync(join(appDir, root));
	} catch {
		throw refuse(`root directory ${root} not found`);
	}

	const base = realpathSync(appDir);

	if (resolved !== base && !resolved.startsWith(`${base}/`)) {
		throw refuse(`root directory ${root} leaves the bot folder`);
	}

	const segments = resolved === base ? [] : resolved.slice(base.length + 1).split("/");
	const reserved = segments[0] === STATE_ENTRY ? STATE_ENTRY : segments.includes(".git") ? ".git" : null;

	if (reserved !== null) {
		throw refuse(`root directory ${root} points inside ${reserved}`);
	}

	if (!isDirectory(resolved)) {
		throw refuse(`root directory ${root} not found`);
	}

	return resolved;
};

export const toolEnvironment = (env, stateDir) => {
	return {
		...botEnvironment(env),
		npm_config_cache: env.npm_config_cache ?? join(stateDir, "cache", "npm"),
		npm_config_update_notifier: "false",
		npm_config_fund: "false",
		npm_config_audit: "false",
		COREPACK_HOME: env.COREPACK_HOME ?? join(stateDir, "cache", "corepack"),
		COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
	};
};

export const sourceListing = async (context) => {
	const { appDir, stateDir, env, synced } = context;
	const gitDir =
		synced?.source === Source.Snapshot
			? join(stateDir, HISTORY_DIR)
			: synced?.source === Source.Git
				? join(appDir, ".git")
				: null;

	if (gitDir === null || !isDirectory(gitDir)) {
		return null;
	}

	const result = await run(gitArgv(`--git-dir=${gitDir}`, `--work-tree=${appDir}`, "ls-files", "-z"), {
		cwd: appDir,
		env: gitEnvironment(env, null, null),
		echo: false,
		capture: true,
	});

	return result.code === 0 ? new Set(result.stdout.split("\0").filter((file) => file.length > 0)) : null;
};

export const projectPrefix = (appDir, projectDir) => {
	try {
		const base = realpathSync(appDir);
		const project = realpathSync(projectDir);

		if (project === base) {
			return "";
		}

		return project.startsWith(`${base}/`) ? `${project.slice(base.length + 1)}/` : null;
	} catch {
		return null;
	}
};

export const carriedBy = (listing, prefix) => {
	return (file) => listing === null || prefix === null || listing.has(`${prefix}${file}`);
};

const installDependencies = async (context) => {
	const { appDir, projectDir, stateDir, env, reinstall, table } = context;
	const declared = serverkJsonOf(readText(join(projectDir, table.serverkJson.file)), table);
	const installCommand = text(env.SERVERK_INSTALL_COMMAND) ?? declared?.install ?? null;
	const carried = carriedBy(await sourceListing(context), projectPrefix(appDir, projectDir));
	const present = new Set(
		[
			table.node.manifest,
			...table.node.lockfiles.map((entry) => entry.file),
		].filter((file) => isFile(join(projectDir, file)) && carried(file)),
	);
	const plan = detectManager(present, table);

	if (!plan && !installCommand) {
		say("no package.json, skipping dependencies");

		return;
	}

	const modules = join(projectDir, "node_modules");
	const stampPath = join(stateDir, DEPS_STAMP);
	const manager = installCommand ? "custom" : plan.manager;
	const hash = dependencyHash([
		installCommand ?? plan.manager,
		process.version,
		text(env.SERVERK_ROOT_DIRECTORY) ?? "",
		readText(join(projectDir, table.node.manifest)) ?? "",
		plan?.lockfile ? (readText(join(projectDir, plan.lockfile)) ?? "") : "",
	]);

	if (reinstall) {
		say("reinstall requested, removing node_modules");

		rmSync(modules, {
			force: true,
			recursive: true,
		});
	}

	if (!reinstall && dependenciesCurrent(readJson(stampPath), hash, isDirectory(modules))) {
		say(`dependencies are up to date (${manager})`);

		return;
	}

	rmSync(stampPath, {
		force: true,
	});

	const argv = installCommand ? shellCommand(installCommand) : table.node.installCommands[plan.manager];

	say(`installing dependencies: ${installCommand ?? argv.join(" ")}`);

	const result = await run(argv, {
		cwd: projectDir,
		env: toolEnvironment(env, stateDir),
	});

	if (result.code !== 0) {
		throw new LaunchFailure(Stage.Install, INSTALL_HINT, `install failed: ${result.last}`, result.last);
	}

	writeJson(stampPath, {
		hash,
		modules: isDirectory(modules),
		manager,
		runtime: process.version,
		installedAt: new Date().toISOString(),
	});

	say("dependencies installed");
};

const resolveStart = (projectDir, env, table) => {
	const packageJson = readJson(join(projectDir, table.node.manifest));
	const files = new Set(startCandidates(packageJson, table).filter((file) => isFile(join(projectDir, file))));

	return detectStart(
		files,
		packageJson,
		{
			startCommand: env.SERVERK_START_COMMAND,
			serverkJson: serverkJsonOf(readText(join(projectDir, table.serverkJson.file)), table),
			procfile: readText(join(projectDir, table.procfile.file)),
		},
		table,
	);
};

const executableOf = (program) => {
	if (program === "node") {
		return process.execPath;
	}

	if (program === "sh") {
		return "/bin/sh";
	}

	return program;
};

export const intendedSource = (env, request) => {
	if (request.snapshot !== null) {
		return Source.Snapshot;
	}

	return text(env.SERVERK_REPO_URL) ? Source.Git : Source.Local;
};

const recordDeployment = (context, outcome, details) => {
	const { env, stateDir, request } = context;

	if (!request?.deploying || request.deployment === null) {
		return;
	}

	const source = details.source ?? intendedSource(env, request);
	const commit = details.commit ?? null;

	writeJson(join(stateDir, DEPLOYMENT_STAMP), {
		deployment: request.deployment,
		source,
		ref: request.snapshot === null ? request.ref : null,
		commit,
		snapshot: request.snapshot,
		outcome,
		stage: details.stage ?? null,
		detail: details.detail ?? null,
		finishedAt: new Date().toISOString(),
	});

	process.stdout.write(
		`${deploymentLine(request.deployment, outcome, {
			...details,
			commit: source === Source.Git ? commit : null,
		})}\n`,
	);
};

export const resumeStateOf = (raw) => {
	const state = parseObject(typeof raw === "string" ? raw : null);
	const request = state?.request;
	const synced = state?.synced;
	const nullable = (value, pattern) => value === null || (typeof value === "string" && pattern.test(value));

	if (
		typeof request !== "object"
		|| request === null
		|| !nullable(request.deployment, ID_PATTERN)
		|| !nullable(request.ref, REPO_REF_PATTERN)
		|| !nullable(request.snapshot, ID_PATTERN)
		|| typeof request.reinstall !== "boolean"
		|| typeof request.deploying !== "boolean"
		|| typeof synced !== "object"
		|| synced === null
		|| !Object.values(Source).includes(synced.source)
		|| !nullable(synced.commit, /^[0-9a-f]{40,64}$/)
	) {
		return null;
	}

	return {
		request: {
			deployment: request.deployment,
			ref: request.ref,
			snapshot: request.snapshot,
			reinstall: request.reinstall,
			deploying: request.deploying,
		},
		synced: {
			source: synced.source,
			commit: synced.commit,
		},
	};
};

const resumeWithoutToken = (mode, context) => {
	const next = {
		...context.env,
		[RESUME_KEY]: JSON.stringify({
			request: context.request,
			synced: context.synced,
		}),
	};

	delete next.SERVERK_GIT_TOKEN;

	process.execve(
		process.execPath,
		[
			process.execPath,
			fileURLToPath(import.meta.url),
			...(mode === "install"
				? [
						"install",
					]
				: []),
		],
		next,
	);
};

const launch = async (mode, context) => {
	const env = process.env;
	const appDir = process.cwd();
	const stateDir = text(env.SERVERK_STATE_DIR) ?? DEFAULT_STATE_DIR;

	mkdirSync(stateDir, {
		recursive: true,
	});

	Object.assign(context, {
		env,
		appDir,
		stateDir,
		table: loadDetectTable(env),
	});

	const resumed = resumeStateOf(env[RESUME_KEY]);

	if (resumed) {
		context.request = resumed.request;
		context.synced = resumed.synced;
	} else {
		if (mode === "install") {
			context.request = {
				...resolveRequest(env, null, false, null),
				deploying: false,
				reinstall: false,
			};
		} else {
			const marker = parseMarker(takeMarker(join(stateDir, DEPLOY_MARKER)));
			const legacyReinstall = takeMarker(join(stateDir, LEGACY_REINSTALL_MARKER)) !== null;

			context.request = resolveRequest(env, marker, legacyReinstall, readJson(join(stateDir, DEPLOYMENT_STAMP)));

			if (context.request.deploying && context.request.deployment) {
				say(`deploying ${context.request.deployment}`);
			}
		}

		context.stage = sourceStage(context.request);
		context.synced = await syncSource(context);

		if (env.SERVERK_GIT_TOKEN !== undefined) {
			resumeWithoutToken(mode, context);
		}
	}

	context.stage = sourceStage(context.request);
	context.projectDir = resolveProjectDir(appDir, text(env.SERVERK_ROOT_DIRECTORY), sourceStage(context.request));

	context.stage = Stage.Install;
	await installDependencies({
		...context,
		reinstall: context.request.reinstall,
	});

	if (mode === "install") {
		process.exit(0);
	}

	context.stage = Stage.Start;

	const start = resolveStart(context.projectDir, env, context.table);

	if (!start) {
		throw new LaunchFailure(
			Stage.Start,
			START_HINT,
			"start failed: nothing to start. Add a start script to package.json or an index.js, or set a start command in the bot's settings",
			"nothing to start",
			EXIT_CONFIG,
		);
	}

	recordDeployment(context, Outcome.Ready, context.synced);

	const [program, ...args] = start.argv;
	const execEnv = {
		...botEnvironment(env),
		...(env[NODE_OPTIONS_KEY] !== undefined
			? {
					NODE_OPTIONS: env[NODE_OPTIONS_KEY],
				}
			: {}),
		PATH: `${join(context.projectDir, "node_modules", ".bin")}:${env.PATH ?? "/usr/local/bin:/usr/bin:/bin"}`,
	};

	say(`start command: ${start.argv.join(" ")}`);
	process.stdout.write(`${READY_LINE}\n`);

	process.chdir(context.projectDir);
	process.execve(
		executableOf(program),
		[
			program,
			...args,
		],
		execEnv,
	);
};

const invokedDirectly = () => {
	const entry = process.argv[1];

	if (!entry) {
		return false;
	}

	try {
		return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
	} catch {
		return false;
	}
};

if (invokedDirectly()) {
	const context = {
		request: null,
		stage: Stage.Sync,
		synced: null,
	};

	launch(process.argv[2] === "install" ? "install" : "start", context).catch((error) => {
		const failure =
			error instanceof LaunchFailure
				? error
				: new LaunchFailure(
						context.stage,
						null,
						`${context.stage} failed: ${error instanceof Error ? error.message : String(error)}`,
						error instanceof Error ? error.message : String(error),
					);

		if (failure.arabic) {
			say(failure.arabic);
		}

		say(failure.english);

		if (context.stateDir) {
			recordDeployment(context, Outcome.Failed, {
				source: context.synced?.source,
				commit: context.synced?.commit,
				stage: failure.stage,
				detail: failure.detail,
			});
		}

		process.exit(failure.code);
	});
}
