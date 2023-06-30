import { App } from "obsidian";
import { deleteFiles, getFileList } from "./server-client";
import { Blog } from "./types";

import { PostManifest } from "./post-manifest";
import { AssetManifest } from "./asset-manifest";

export class SyncManager {
	private app: App;
	private blog: Blog;

	constructor(app: App, blog: Blog) {
		this.app = app;
		this.blog = blog;
	}

	push = async () => {
		const filesResponse = await getFileList(this.blog);
		console.log(filesResponse);
		if (!("json" in filesResponse)) {
			return {
				code: "GET_FILES_FAILURE",
				status: filesResponse.status,
			};
		}

		const postManifest = new PostManifest(
			filesResponse.json.posts,
			this.blog,
			this.app
		);
		const assetManifest = new AssetManifest(
			filesResponse.json.assets,
			postManifest.embeddedAssetPaths,
			this.blog,
			this.app
		);

		console.log("assets", assetManifest.pendingAssets);
		// Not sure why but Promise.all seems to error out with ERR_EMPTY_RESPONSE sometimes
		// IMPROVEMENT: look into batching requests
		for (const post of postManifest.pendingPosts) {
			await post.upload();
		}
		for (const asset of assetManifest.pendingAssets) {
			await asset.upload();
		}

		return {
			deleteResult: await this.deleteMany([
				...postManifest.postsToDelete,
				...assetManifest.assetsToDelete,
			]),
			uploadResult: postManifest.uploadResult,
			assetUpload: assetManifest.uploadResult,
		};
	};

	private deleteMany = async (keys: string[]) => {
		if (!keys.length) {
			return;
		}
		const response = await deleteFiles({
			keys,
			apiKey: this.blog.apiKey,
			endpoint: this.blog.endpoint,
		});

		return [keys, response.status];
	};
}
