import { Plugin } from "obsidian";
import { TuhuaSettingTab } from "src/settings";
import { registerBlogCommands, registerPluginCommands } from "src/commands";
import { UploadSession } from "src/shared/plugin-data/upload-session";
import { PluginData, maybeInitialisePluginData } from "src/shared/plugin-data";

export default class BlogSync extends Plugin {
	updateLog: Record<string, boolean>[] = [];
	currentUploadSession: UploadSession | null = null;

	async onload() {
		const context = {
			app: this.app,
			plugin: this,
			isDev: Boolean(process.env.DEV),
		};

		let seed: PluginData | undefined = undefined;
		// Set using esbuild define. See https://esbuild.github.io/api/#define
		// Don't wrap the boolean as we use it to dynamically import the seeding data
		if (process.env.DEV) {
			const seedJson = await import("./.seed.json");
			seed = seedJson.default;
		}

		await maybeInitialisePluginData(seed)(context)();
		// TODO: think about migration

		this.addSettingTab(new TuhuaSettingTab(this.app, this));
		await registerPluginCommands()(context)();
		await registerBlogCommands()(context)();
	}

	currentSession() {
		return Promise.resolve(this.currentUploadSession);
	}

	onunload() {
		this.currentUploadSession = null;
	}
}
