import { App, Plugin, TFile } from "obsidian";
import { SyncManager } from "src/sync-manager";
import Logger from "js-logger";
import { SettingTab } from "src/setting-tab";
import { getSyncCandidateFiles, processManifest } from "src/manifest-fp";
import { getFileList } from "src/server-client";

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
					const network = new SyncManager(
						this.app,
						this.settingTab.blogs[i]
					);
					const result = await network.push();
					console.log(result);
					Logger.info(result);
				},
			});

			this.addCommand({
				id: `test-test-${id}`,
				name: `test for ${name}`,
				callback: async () => {
					Logger.setLevel(Logger.DEBUG);
					const blog = this.settingTab.blogs[i];
					const filesResponse = await getFileList(blog);
					if (!("json" in filesResponse)) {
						return {
							code: "GET_FILES_FAILURE",
							status: filesResponse.status,
						};
					}

					const files = [
						...filesResponse.json.posts,
						...filesResponse.json.assets,
					];
					console.log(filesResponse, files);
					const res = await processManifest(files)({
						blog,
						app: this.app,
					})();
					if (res._tag === "Right") {
						console.log(res.right);
					}

					const file =
						this.app.vault.getAbstractFileByPath(
							"TestBlog/About.md"
						);

					if (file instanceof TFile) {
						// const deps = {
						// 	file,
						// 	serverMd5: "",
						// 	app: this.app,
						// 	blog: this.settingTab.blogs[i],
						// };
						// const e = await tester([1, 2, 3, 4])({
						// 	n: new Map<number, number>(),
						// })({})();
						// console.log(e);
						// const d = await processPost(deps)();
						// console.log(d);
						// const d = await getFilesToBeSynced_SRTE({
						// 	app: this.app,
						// 	blog: this.settingTab.blogs[i],
						// })();
						// console.log(d);
						// const res = await testMd5(file)({ app: this.app })();
						// console.log(res);
						// if (res._tag === "Right") {
						// 	console.log(res.right);
						// }
					}
				},
			});
		}
	};

	onunload() {
		// IMPROVEMENT: can I abort ongoing network requests?
	}
}
