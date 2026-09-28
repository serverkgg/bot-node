import { BOT_STATE_DIR, LAUNCHER_STATE_DIR } from "@serverkgg/bridge/bot";

export const HOME_DIR = "/home/container";

export const STATE_DIR = `${HOME_DIR}/${BOT_STATE_DIR}`;

export const RUNTIME = "node";

export const LAUNCHER_PATH = "/serverk/launcher.mjs";

export const INSTALL_MODE = "install";

export const INSTALL_STAMP = `${BOT_STATE_DIR}/install.json`;

export const HEAP_SHARE = 0.75;

export const HEAP_FLOOR_MB = 64;

export const NODE_OPTIONS = "NODE_OPTIONS";

export const LAUNCHER_NODE_OPTIONS = "SERVERK_NODE_OPTIONS";

export const launcherCommand = (...args: string[]) => {
	return [
		RUNTIME,
		LAUNCHER_PATH,
		...args,
	];
};

export const heapMb = (memoryMb: number) => {
	return Math.max(HEAP_FLOOR_MB, Math.floor(memoryMb * HEAP_SHARE));
};

export const toolEnvironment = (memoryMb: number): Record<string, string> => {
	return {
		TZ: "UTC",
		HOME: HOME_DIR,
		[NODE_OPTIONS]: `--max-old-space-size=${heapMb(memoryMb)}`,
		npm_config_cache: `${STATE_DIR}/cache/npm`,
		[LAUNCHER_STATE_DIR]: STATE_DIR,
	};
};
