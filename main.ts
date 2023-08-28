import { Plugin } from "obsidian";
import { TuhuaSettingTab } from "src/settings/settings-tab";
import { registerBlogCommands, registerPluginCommands } from "src/commands";
import { UploadSession } from "src/shared/plugin-data/upload-session";
import { maybeInitialisePluginData } from "src/shared/plugin-data";

export default class BlogSync extends Plugin {
	updateLog: Record<string, boolean>[] = [];
	currentUploadSession: UploadSession | null = null;

	async onload() {
		const context = {
			app: this.app,
			plugin: this,
		};
		await maybeInitialisePluginData()(context)();
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
