import { App, Plugin, TFile } from "obsidian";
import Logger from "js-logger";
import { SettingTab } from "src/settings/setting-tab";
import { buildPluginConfig } from "src/plugin-config";
import { upload } from "src/actions/v2/upload";

export default class BlogSync extends Plugin {
	settingTab?: SettingTab;
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
		for (let i = 0; i < this.settingTab!.blogs.length; i++) {
			const blog = this.settingTab!.blogs[i];
			const { id, name } = blog;

			this.addCommand({
				id: `test-upload-blog-${id}`,
				name: `Push updates to ${name}`,
				callback: async () => {
					Logger.setLevel(Logger.DEBUG);
					const e = await upload({ app: this.app, blog });
					if (e._tag === "Left") {
						console.log(e.left);
						return;
					}
					console.log(e.right);
				},
			});

			this.addCommand({
				id: `test-debug-${id}`,
				name: `xdebug ${name}`,
				callback: async () => {
					// const file =
					// 	this.app.vault.getAbstractFileByPath("md5-test.png");
					// const pluginConfig = buildPluginConfig();
					// const blog = this.settingTab.blogs[i];
					// if (file instanceof TFile) {
					// }
					// console.log("wtf");
					// const blog = this.settingTab.blogs[i];
					// await uploadWithoutConfirming({ app: this.app, blog });
				},
			});
		}
	};

	onunload() {
		// IMPROVEMENT: can I abort ongoing network requests?
	}
}
