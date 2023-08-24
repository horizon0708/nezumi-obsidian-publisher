import { App, Plugin, TFile } from "obsidian";
import Logger from "js-logger";
import { SettingTab } from "src/settings/setting-tab";
import { buildPluginConfig } from "src/plugin-config";
import { upload } from "src/actions/upload/upload";
import { NewSettingTab } from "src/settings-new/settings-tab-new";
import { saveData } from "src/io/obsidian-fp";

export default class BlogSync extends Plugin {
	settingTab?: SettingTab;
	updateLog: Record<string, boolean>[] = [];

	getApp = () => {
		return this.app;
	};

	async onload() {
		this.addSettingTab(new NewSettingTab(this.app, this));
		await saveData({
			blogs: [
				{
					id: "asdf",
					name: "Test Blog (dev)",
					apiKey: "bk_42gp0UU3Y1WlqSm5Sdgx8n",
					syncFolder: "TestBlog",
					endpoint: "http://localhost:4000/api",
					subdomain: "testblog",
					logs: [],
				},
				{
					id: "b_02tahK5viJpAXk1LJYvhu3",
					name: "teerwef",
					apiKey: "bk_0E35ek0QaNj4BZ7NtU6uBf",
					syncFolder: "TestBlog",
					endpoint: "http://localhost:4000/api",
					subdomain: "sub",
					logs: [],
				},
			],
		})({ app: this.app, plugin: this })();

		// if (!this.settingTab) {
		// 	const settingTab = new SettingTab(this.app, this);
		// 	this.addSettingTab(settingTab);
		// 	this.settingTab = settingTab;
		// }

		// await this.settingTab.loadSettings();
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
					const e = await upload({
						app: this.app,
						blog,
						plugin: this,
					});
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
