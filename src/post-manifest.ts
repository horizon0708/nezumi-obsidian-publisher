import { App, TFile } from "obsidian";
import { Blog, ServerFile, ServerFileState } from "./types";
import { Post } from "./post";

export class PostManifest {
	private blog: Blog;
	private app: App;
	private serverPosts: Map<string, ServerFileState> = new Map<
		string,
		ServerFileState
	>();
	private localPosts: Map<string, Post> = new Map<string, Post>();
	private localSlugs: Map<string, string> = new Map<string, string>();
	// all embedded assets in all posts
	embeddedAssetPaths: Set<string> = new Set<string>();

	constructor(files: ServerFile[], blog: Blog, app: App) {
		this.blog = blog;
		this.app = app;
		files.forEach(({ path, md5 }) => {
			if (!path.endsWith(".md")) {
				return;
			}

			this.serverPosts.set(path, { md5, hasLocalCopy: false });
		});

		app.vault.getFiles().forEach(this.createAndRegisterPost);
	}

	private createAndRegisterPost = (file: TFile): Post | null => {
		const { path } = file;
		const { localPosts, localSlugs, blog, app, embeddedAssetPaths } = this;

		if (!path.startsWith(blog.syncFolder) || !path.endsWith(".md")) {
			return null;
		}

		const serverPost = this.getServerMd5(file.path);
		if (serverPost) {
			serverPost.hasLocalCopy = true;
		}
		const serverMd5 = serverPost?.md5;
		const post = new Post({ file, blog, app, serverMd5 });

		const existingSlug = localSlugs.get(post.slug);
		if (existingSlug) {
			post.setStatus(
				"skipped",
				`${existingSlug} already has slug: ${post.slug}. Please manually set a unique slug.`
			);
		}
		post.embeddedAssetPaths.forEach((path) => {
			embeddedAssetPaths.add(path);
		});
		localSlugs.set(post.slug, file.path);
		localPosts.set(file.path, post);
		return post;
	};

	private getServerMd5(path: string): ServerFileState | undefined {
		const key =
			this.blog.syncFolder === "/"
				? path
				: path.slice(this.blog.syncFolder.length + 1);

		return this.serverPosts.get(key);
	}

	get allPosts() {
		return [...this.localPosts.values()];
	}

	get pendingPosts() {
		return [...this.localPosts.values()].filter(
			(post) => post.status === "pending"
		);
	}

	get uploadResult() {
		const result: string[][] = [];
		this.localPosts.forEach((value, key, map) => {
			result.push([key, value.status, value.message]);
		});
		return result;
	}

	get postsToDelete() {
		const toDelete: string[] = [];
		this.serverPosts.forEach((value, key, map) => {
			if (!value.hasLocalCopy) {
				toDelete.push(key);
			}
		});
		return toDelete;
	}
}
