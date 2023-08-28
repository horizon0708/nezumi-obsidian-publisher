import { Plugin } from "obsidian";
import { TuhuaSettingTab } from "src/settings/settings-tab";
import { registerBlogCommands } from "src/commands";
import { UploadSession } from "src/shared/plugin-data/upload-session";

export default class BlogSync extends Plugin {
	updateLog: Record<string, boolean>[] = [];
	currentUploadSession: UploadSession | null = null;

	async onload() {
		this.addSettingTab(new TuhuaSettingTab(this.app, this));
		const context = {
			app: this.app,
			plugin: this,
		};
		const e = await registerBlogCommands()(context)();
		console.log(e);
	}

	currentSession() {
		return Promise.resolve(this.currentUploadSession);
	}

	onunload() {
		// INVESTIGATE: can I abort ongoing network requests?
	}
}
