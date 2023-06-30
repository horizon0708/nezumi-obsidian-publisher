import { App, TFile } from "obsidian";
import { Blog, ServerFile, ServerFileState } from "./types";
import { Asset } from "./asset";

export class AssetManifest {
	private blog: Blog;
	private app: App;
	private serverAssets: Map<string, ServerFileState> = new Map<
		string,
		ServerFileState
	>();
	private localAssets: Map<string, Asset> = new Map<string, Asset>();

	constructor(
		files: ServerFile[],
		embeddedAssetPaths: Set<string>,
		blog: Blog,
		app: App
	) {
		this.blog = blog;
		this.app = app;
		files.forEach(({ path, md5 }) => {
			if (path.endsWith(".md")) {
				return;
			}

			this.serverAssets.set(path, { md5, hasLocalCopy: false });
		});
		embeddedAssetPaths.forEach(this.createAndRegisterAsset);
	}

	private createAndRegisterAsset = (path: string): Asset | null => {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return null;
		}

		const { localAssets: localPosts, blog, app } = this;
		const serverPost = this.serverAssets.get(file.path);
		if (serverPost) {
			serverPost.hasLocalCopy = true;
		}
		const serverMd5 = serverPost?.md5;
		const post = new Asset({ file, blog, app, serverMd5 });

		localPosts.set(file.path, post);
		return post;
	};

	get allAssets() {
		return [...this.localAssets.values()];
	}

	get pendingAssets() {
		return [...this.localAssets.values()].filter(
			(post) => post.status === "pending"
		);
	}

	get uploadResult() {
		const result: string[][] = [];
		this.localAssets.forEach((value, key, map) => {
			result.push([key, value.status, value.message]);
		});
		return result;
	}

	get assetsToDelete() {
		const toDelete: string[] = [];
		this.serverAssets.forEach((value, key, map) => {
			if (!value.hasLocalCopy) {
				toDelete.push(key);
			}
		});
		return toDelete;
	}
}
