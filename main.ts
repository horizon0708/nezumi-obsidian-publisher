import { Plugin } from "obsidian";
import { NewSettingTab } from "src/settings-new/settings-tab-new";
import { registerPushUpdateCommand } from "src/commands";

export default class BlogSync extends Plugin {
	updateLog: Record<string, boolean>[] = [];

	async onload() {
		this.addSettingTab(new NewSettingTab(this.app, this));
		const context = {
			app: this.app,
			plugin: this,
		};
		await registerPushUpdateCommand()(context)();
	}

	onunload() {
		// INVESTIGATE: can I abort ongoing network requests?
	}
}
