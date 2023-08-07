import { App, Plugin, TFile } from "obsidian";
import Logger from "js-logger";
import { SettingTab } from "src/settings/setting-tab";
import { buildPluginConfig } from "src/plugin-config";
import { syncFiles } from "src/plugin-actions";

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
					Logger.setLevel(Logger.DEBUG);
					const blog = this.settingTab.blogs[i];
					const e = await syncFiles({ app: this.app, blog });
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
					const file =
						this.app.vault.getAbstractFileByPath("md5-test.png");
					const pluginConfig = buildPluginConfig();
					const blog = this.settingTab.blogs[i];
					if (file instanceof TFile) {
					}
				},
			});

			this.addCommand({
				id: `test-test-${id}`,
				name: `test for ${name}`,
				callback: async () => {
					Logger.setLevel(Logger.DEBUG);
					const blog = this.settingTab.blogs[i];
					const e = await syncFiles({ app: this.app, blog });
					if (e._tag === "Left") {
						console.log(e.left);
						return;
					}
					console.log(e.right);

					// const filesResponse = await getFileListFp({
					// 	blog,
					// 	pluginConfig,
					// })();
					// if (filesResponse._tag === "Left") {
					// 	console.log(filesResponse.left);
					// 	return;
					// }
					// const files = [
					// 	...filesResponse.right.posts,
					// 	...filesResponse.right.assets,
					// ];

					// console.log(filesResponse, files);

					// const res = await processManifest({
					// 	blog,
					// 	app: this.app,
					// 	files,
					// })();
					// if (res._tag === "Right") {
					// 	console.log(res.right);
					// }
				},
			});
		}
	};

	onunload() {
		// IMPROVEMENT: can I abort ongoing network requests?
	}
}
