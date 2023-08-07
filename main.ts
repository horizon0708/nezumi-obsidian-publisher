import { App, Plugin, TFile } from "obsidian";
import { SyncManager } from "src/sync-manager";
import Logger from "js-logger";
import { SettingTab } from "src/setting-tab";
import {
	buildServerFiles,
	emptyFileProcessingState,
	prepareFiles,
} from "src/manifest-fp";
import { readerInjection, readerInjection2, sampleRte } from "src/archive";
import { getFileListFp, uploadAsset } from "src/network";
import { buildPluginConfig } from "src/plugin-config";
import { syncFiles } from "src/plugin-actions";
import { pipe } from "fp-ts/lib/function";
import { processAsset } from "src/sync-fs";
import * as TE from "fp-ts/TaskEither";
import { uploadAssetDe } from "src/server-client";

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
				id: `test-debug-${id}`,
				name: `xdebug ${name}`,
				callback: async () => {
					// const b = await readerInjection2({ b: "b" })(sampleRte)({
					// 	a: "a",
					// })();
					// console.log(b);
					const file =
						this.app.vault.getAbstractFileByPath("md5-test.png");
					console.log(file);
					const pluginConfig = buildPluginConfig();
					const blog = this.settingTab.blogs[i];
					if (file instanceof TFile) {
						const rr = await uploadAssetDe({
							type: "asset",
							md5: "123",
							content: new ArrayBuffer(8),
							path: "md5-test.png",
							apiKey: blog.apiKey,
							endpoint: blog.endpoint,
						});

						await pipe(
							processAsset(emptyFileProcessingState)({
								app: this.app,
								file,
								blog: this.settingTab.blogs[i],
								pluginConfig,
							}),
							TE.chain(([asset, state]) => {
								return uploadAsset({ ...asset, type: "asset" })(
									{
										blog: this.settingTab.blogs[i],
										pluginConfig,
									}
								);
							}),
							TE.map(console.log)
						)();
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
