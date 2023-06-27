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

		const toTryUpload = this.app.vault
			.getFiles()
			.filter((file) => file.path.startsWith(this.syncFolder))
			.map((file) => file.path);

		// Not sure why but Promise.all seems to error out with ERR_EMPTY_RESPONSE on some files
		// IMPROVEMENT: look into batching requests
		for (const path of toTryUpload) {
			await this.upload(path, manifest);
		}

		return {
			deleteResult: await this.deleteMany(manifest.getFilesToDelete),
			uploadResult: manifest.uploadResult,
		};
	};

	private upload = async (path: string, manifest: Manifest) => {
		try {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!file) {
				manifest.skipped(path, "Not a valid file");
				return;
			}
			if (!(file instanceof TFile)) {
				manifest.skipped(path, "Is a folder");
				return;
			}
			const { apiKey, endpoint } = this.blog;
			const slug = this.getSlug(file);
			if (slug) {
				const duplicatePath = manifest.addSlugAndCheckCollision(
					path,
					slug
				);

				if (duplicatePath) {
					manifest.skippedDueToCollsion(
						path,
						`${duplicatePath} already has slug: ${slug}. Please manually set a unique slug.`
					);
					return;
				}
			}

			const { type, md5, content } = await this.readFile(file);
			const serverMd5 = manifest.getServerMd5(file.path);
			if (serverMd5 && serverMd5 === md5) {
				manifest.skipped(path, "MD5 matches");
				return;
			}

			const basePayload = {
				slug,
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
		this.addSlug(file, newSlug);
		return newSlug;
	};

	private addSlug = async (file: TFile, slug: string) => {
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
