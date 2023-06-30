import { App, TFile } from "obsidian";
import { Manifest } from "./manifest";
import { pluginConfig } from "./plugin-config";
import { Blog } from "./types";
import SparkMD5 from "spark-md5";
import { uploadPost } from "./server-client";

type PostParams = {
	blog: Blog;
	file: TFile;
	app: App;
	manifest: Manifest;
};

export class Post {
	private file: TFile;
	private blog: Blog;
	private app: App;
	private manifest: Manifest;
	private slug: string;
	private status: "pending" | "skipped" | "uploaded" | "failed" = "pending";
	private reason: string | null = null;

	constructor({ file, blog, app, manifest }: PostParams) {
		this.file = file;
		this.blog = blog;
		this.app = app;
		this.slug = file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-");
		this.manifest = manifest;
	}

	get isValid() {
		const { path } = this.file;
		if (!path.startsWith(this.blog.syncFolder) || !path.endsWith(".md")) {
			return false;
		}
		const slug =
			this.app.metadataCache.getFileCache(this.file)?.frontmatter?.[
				pluginConfig.slugKey
			] ?? this.slug;

		this.addSlugToFrontmatter(this.file, slug);
		return !this.manifest.hasSlugCollision(path, slug);
	}

	upload = async () => {
		try {
			const { apiKey, endpoint } = this.blog;
			const content = await this.app.vault.cachedRead(this.file);
			const md5 = SparkMD5.hash(content);
			const serverMd5 = this.manifest.getServerMd5(this.file.path);
			if (serverMd5 && serverMd5 === md5) {
				this.manifest.skipped(this.file.path, "MD5 matches");
				return;
			}

			const payload = {
				slug: this.slug,
				path: this.pathWithoutSyncFolder,
				apiKey,
				endpoint,
				md5,
				type: "post" as const,
				content,
			};

			const res = await uploadPost(payload);
			if (!("json" in res)) {
				this.manifest.failed(this.file.path, res.error);
			}
		} catch (e) {
			this.manifest.failed(this.file.path, e.message);
		}
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

	private get pathWithoutSyncFolder() {
		if (this.blog.syncFolder !== "/") {
			return this.file.path.slice(this.blog.syncFolder.length + 1);
		}
		return this.file.path;
	}
}
