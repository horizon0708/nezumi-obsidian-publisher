import { Plugin } from "obsidian";
import { TuhuaSettingTab } from "src/settings";
import {
	registerBlogCommands,
	registerDebugBlogCommands,
	registerDebugPluginCommands,
	registerPluginCommands,
} from "src/commands";
import { PluginData, maybeInitialisePluginData } from "src/shared/plugin-data";

export default class BlogSync extends Plugin {
	updateLog: Record<string, boolean>[] = [];
	currentSessionId: string | null = null;

	async onload() {
		const context = {
			app: this.app,
			plugin: this,
		};

		let seed: PluginData | undefined = undefined;
		// Set using esbuild define. See https://esbuild.github.io/api/#define
		// Esbuilds uses this variable to dynamically import the seeding data
		if (process.env.DEV) {
			const seedJson = await import("./.seed.json");
			seed = seedJson.default;
		}

		await maybeInitialisePluginData(seed)(context)();
		// TODO: think about plugin data migration

		this.addSettingTab(new TuhuaSettingTab(this.app, this));
		await registerPluginCommands()(context)();
		await registerBlogCommands()(context)();
		if (process.env.DEV) {
			await registerDebugPluginCommands()(context)();
			await registerDebugBlogCommands()(context)();
		}
	}

	currentSession() {
		return Promise.resolve(this.currentSessionId);
	}

	onunload() {
		this.currentSessionId = null;
	}
}
