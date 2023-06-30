import { App, TFile } from "obsidian";
import {
	deleteFiles,
	getFileList,
	uploadAsset,
	uploadPost,
} from "./server-client";
import { Blog } from "./types";
import { Manifest } from "./manifest";
import SparkMD5 from "spark-md5";
import { pluginConfig } from "./plugin-config";
import { Post } from "./post";
import { PostManifest } from "./post-manifest";

const SLUG = "slug";

export class SyncManager {
	private app: App;
	private syncFolder: string;
	private blog: Blog;

	constructor(app: App, blog: Blog) {
		this.app = app;
		this.syncFolder = blog.syncFolder;
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
		const manifest = new Manifest(
			filesResponse.json.files,
			this.blog.syncFolder
		);
		const postManifest = new PostManifest(
			filesResponse.json.files,
			this.blog,
			this.app
		);

		// postFiles.forEach((file) => {
		// 	this.recordEmbeddedAssetPaths(file, manifest);
		// });
		console.log("assets", manifest.assetsToUpload);
		// Not sure why but Promise.all seems to error out with ERR_EMPTY_RESPONSE on some files
		// IMPROVEMENT: look into batching requests
		for (const post of postManifest.pendingPosts) {
			await post.upload();
		}
		for (const path of manifest.assetsToUpload) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await this.upload(file, manifest);
			}
		}

		return {
			deleteResult: await this.deleteMany(manifest.getFilesToDelete),
			uploadResult: postManifest.uploadResult,
		};
	};

	private filterForPosts = (file: TFile, manifest: Manifest) => {
		const { path } = file;
		if (!path.startsWith(this.syncFolder) || !path.endsWith(".md")) {
			return false;
		}
		const slug =
			this.app.metadataCache.getFileCache(file)?.frontmatter?.[
				pluginConfig.slugKey
			] ?? file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-");

		this.addSlugToFrontmatter(file, slug);
		return !manifest.hasSlugCollision(path, slug);
	};

	private recordEmbeddedAssetPaths = (file: TFile, manifest: Manifest) => {
		const fileLinks = this.app.metadataCache.resolvedLinks[file.path];
		if (!fileLinks) {
			return;
		}
		for (const path in fileLinks) {
			console.log(path);
			if (!path.endsWith(".md")) {
				manifest.addAssetPath(path);
			}
		}
	};

	private upload = async (file: TFile, manifest: Manifest) => {
		const { path } = file;
		try {
			const { apiKey, endpoint } = this.blog;
			const { type, md5, content } = await this.readFile(file);
			const serverMd5 = manifest.getServerMd5(file.path);
			if (serverMd5 && serverMd5 === md5) {
				manifest.skipped(path, "MD5 matches");
				return;
			}

			const basePayload = {
				slug: this.getSlug(file),
				path: manifest.stripSyncFolder(file.path),
				apiKey,
				endpoint,
				md5,
			};

			// IMPROVEMENT: add dry run
			// IMPROVEMENT: add retry
			const res =
				type === "post"
					? await uploadPost({
							...basePayload,
							type: "post",
							content: content as string,
					  })
					: await uploadAsset({
							...basePayload,
							type: "asset",
							content: content as ArrayBuffer,
					  });

			if (!("json" in res)) {
				manifest.failed(path, res.error);
				return;
			}

			manifest.succeeded(path);
			return;
		} catch (e) {
			manifest.failed(path, e.message);
			return;
		}
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

	private readFile = async (file: TFile) => {
		const { extension } = file;
		if (extension === "md") {
			const content = await this.app.vault.cachedRead(file);
			return {
				type: "post" as const,
				content,
				md5: SparkMD5.hash(content),
			};
		}
		const content = await this.app.vault.readBinary(file);
		return {
			type: "asset" as const,
			content,
			md5: SparkMD5.ArrayBuffer.hash(content),
		};
	};

	// get slug from frontmatter or generate one.
	// the generated slug is added to the frontmatter.
	private getSlug = (file: TFile) => {
		if (file.extension !== "md") {
			return;
		}

		const existingSlug =
			this.app.metadataCache.getFileCache(file)?.frontmatter?.[
				pluginConfig.slugKey
			];

		if (existingSlug) {
			return existingSlug;
		}

		let newSlug = file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-");
		this.addSlugToFrontmatter(file, newSlug);
		return newSlug;
	};

	private addSlugToFrontmatter = async (file: TFile, slug: string) => {
		try {
			await this.app.fileManager.processFrontMatter(
				file,
				(frontmatter) => {
					frontmatter[pluginConfig.slugKey] = slug;
				}
			);
		} catch (e) {}
	};
}
