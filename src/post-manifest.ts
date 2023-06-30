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

	constructor(files: ServerFile[], blog: Blog, app: App) {
		this.blog = blog;
		this.app = app;
		files.forEach(({ path, md5 }) => {
			const p =
				this.blog.syncFolder === "/"
					? path
					: path.slice(this.blog.syncFolder.length + 1);

			this.serverPosts.set(p, { md5, hasLocalCopy: false });
		});

		app.vault.getFiles().forEach(this.createAndRegisterPost);
	}

	private createAndRegisterPost = (file: TFile): Post | null => {
		const { path } = file;
		const { localPosts, localSlugs, blog, app } = this;

		if (!path.startsWith(blog.syncFolder) || !path.endsWith(".md")) {
			return null;
		}

		const serverPost = this.serverPosts.get(file.path);
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
		localSlugs.set(post.slug, file.path);
		localPosts.set(file.path, post);
		return post;
	};

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
}
