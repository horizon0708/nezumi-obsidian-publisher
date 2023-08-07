import { App, TFile } from "obsidian";
import { buildPluginConfig } from "./plugin-config";
import { Blog, FileUploadState } from "./types";
import SparkMD5 from "spark-md5";
import { uploadPost } from "./server-client";

type PostParams = {
	blog: Blog;
	file: TFile;
	app: App;
	serverMd5?: string;
};

export class Post {
	private file: TFile;
	private blog: Blog;
	private app: App;
	private serverMd5?: string;
	slug: string;
	status: FileUploadState = "pending";
	message?: string;

	constructor({ file, blog, app, serverMd5 }: PostParams) {
		this.file = file;
		this.blog = blog;
		this.app = app;
		this.slug =
			this.slugFromFrontmatter ??
			file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-");
		this.serverMd5 = serverMd5;
	}

	upload = async () => {
		try {
			const { apiKey, endpoint } = this.blog;

			// add slug to frontmatter before calculating MD5
			await this.addSlugToFrontmatter(this.file, this.slug);

			const content = await this.app.vault.cachedRead(this.file);
			const md5 = SparkMD5.hash(content);
			if (this.serverMd5 && this.serverMd5 === md5) {
				this.setStatus("skipped", "MD5 matches");
				return;
			}
			const res = await uploadPost({
				slug: this.slug,
				path: this.pathWithoutSyncFolder,
				apiKey,
				endpoint,
				md5,
				type: "post",
				content,
			});
			if (!("json" in res)) {
				this.setStatus("failed", res.error);
			}

			this.setStatus("uploaded");
		} catch (e) {
			this.setStatus("failed", e.message);
		}
	};

	setStatus = (status: FileUploadState, message?: string) => {
		this.status = status;
		this.message = message;
	};

	get embeddedAssetPaths() {
		const fileLinks = this.app.metadataCache.resolvedLinks[this.file.path];
		if (!fileLinks) {
			return;
		}
		const paths = [];
		for (const path in fileLinks) {
			if (!path.endsWith(".md")) {
				paths.push(path);
			}
		}
		return paths;
	}

	private get slugFromFrontmatter() {
		const { app, file } = this;
		return app.metadataCache.getFileCache(file)?.frontmatter?.[
			buildPluginConfig().slugKey
		];
	}

	private addSlugToFrontmatter = async (file: TFile, slug: string) => {
		try {
			if (this.slugFromFrontmatter && this.slugFromFrontmatter === slug) {
				return;
			}
			await this.app.fileManager.processFrontMatter(
				file,
				(frontmatter) => {
					frontmatter[buildPluginConfig().slugKey] = slug;
				}
			);
		} catch (e) {}
	};

	private get pathWithoutSyncFolder() {
		if (this.blog.syncFolder !== "/") {
			return this.file.path.slice(this.blog.syncFolder.length + 1);
		}
		return this.file.path;
	}
}
