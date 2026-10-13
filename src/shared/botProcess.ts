import type { Bridge } from "@serverkgg/bridge";
import {
	type BotPlatform,
	botExposureOf,
	botProcessEnvironment,
	customerEnvironment,
	inferBotPlatform,
	launcherEnvironment,
	platformEnvironment,
	readBotConfig,
} from "@serverkgg/bridge/bot";
import { LAUNCHER_NODE_OPTIONS, NODE_OPTIONS, STATE_DIR, toolEnvironment } from "./botRuntime";

export const botPlatformOf = (context: Bridge.Context): BotPlatform | null => {
	return (
		readBotConfig(context).platform
		?? inferBotPlatform({
			variables: context.variables(),
			secrets: context.secrets(),
		})
	);
};

export const processEnvironment = (context: Bridge.Context): Record<string, string> => {
	const { [NODE_OPTIONS]: nodeOptions, ...customer } = customerEnvironment(context.variables(), context.secrets());

	return botProcessEnvironment({
		tool: toolEnvironment(context.server.memoryMb),
		customer,
		launcher: {
			...launcherEnvironment(readBotConfig(context), STATE_DIR),
			...(nodeOptions !== undefined
				? {
						[LAUNCHER_NODE_OPTIONS]: nodeOptions,
					}
				: {}),
		},
		platform: platformEnvironment(context.server.code, botPlatformOf(context), botExposureOf(context)),
	});
};
