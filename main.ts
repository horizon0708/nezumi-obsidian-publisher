import { App, Plugin } from "obsidian";
import { SyncManager } from "src/sync-manager";
import Logger from "js-logger";
import { SettingTab } from "src/setting-tab";

export default class BlogSync extends Plugin {
	settingTab: SettingTab;
	updateLog: Record<string, boolean>[] = [];

	getApp = () => {
		return this.app;
	};

	async onload() {
		if (!this.settingTab) {
			const settingTab = new SettingTab(this.app, this);
			this.addSettingTab(settingTab);
			this.settingTab = settingTab;
		}

		await this.settingTab.loadSettings();
		this.loadCommands();
	}

	loadCommands = () => {
		for (let i = 0; i < this.settingTab.blogs.length; i++) {
			const { id, name } = this.settingTab.blogs[i];

			this.addCommand({
				id: `test-upload-blog-${id}`,
				name: `Push updates to ${name}`,
				callback: async () => {
					const network = new SyncManager(
						this.app,
						this.settingTab.blogs[i]
					);
					const result = await network.push();
					Logger.info(result);
				},
			});
		}
	};

	onunload() {
		// IMPROVEMENT: can I abort ongoing network requests?
	}
}
