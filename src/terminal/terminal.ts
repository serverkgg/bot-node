import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { LAUNCHER_RULES, NODE_RULES } from "@serverkgg/bridge/bot";

export const terminal: Bridge.Terminal = {
	kind: BridgeKind.Terminal,
	commands: [],
	rules: [
		...LAUNCHER_RULES,
		...NODE_RULES,
	],
};
