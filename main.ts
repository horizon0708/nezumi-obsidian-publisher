import { Plugin } from "obsidian";
import { TuhuaSettingTab } from "src/settings/settings-tab";
import { registerPushUpdateCommand } from "src/commands";

export default class BlogSync extends Plugin {
	updateLog: Record<string, boolean>[] = [];

	async onload() {
		this.addSettingTab(new TuhuaSettingTab(this.app, this));
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
