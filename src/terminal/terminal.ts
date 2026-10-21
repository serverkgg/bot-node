import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BOT_RUN_MODE, createBotRun, LAUNCHER_RULES, NODE_RULES } from "@serverkgg/bridge/bot";
import { launcherCommand, processEnvironment } from "../shared";

export const terminal: Bridge.Terminal = {
	kind: BridgeKind.Terminal,
	commands: [],
	rules: [
		...LAUNCHER_RULES,
		...NODE_RULES,
	],
	shell: true,
	run: createBotRun({
		launcherCommand: () => launcherCommand(BOT_RUN_MODE),
		environment: processEnvironment,
	}),
};
