import * as O from "fp-ts/Option";
import { ServerFile } from "./io/network";
type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

export class FileProcessingStateImpl {
	serverPosts: Map<string, ServerFileState>;
	localSlugs: Map<string, string>;
	embeddedAssets: Set<string>;

	constructor(files: ServerFile[] = []) {
		this.serverPosts = new Map<string, ServerFileState>();
		files.forEach(({ path, md5 }) => {
			this.serverPosts.set(path, { md5, hasLocalCopy: false });
		});

		this.localSlugs = new Map<string, string>();
		this.embeddedAssets = new Set<string>();
	}

	registerLocalCopy = (path: string) => {
		const sp = this.serverPosts.get(path);
		if (sp) {
			sp.hasLocalCopy = true;
		}
		return this;
	};

	getServerMd5 = (path: string) => {
		const sp = this.serverPosts.get(path);
		return O.fromNullable(sp?.md5);
	};

	markLocalCopy = (path: string) => {
		const sp = this.serverPosts.get(path);
		if (sp) {
			sp.hasLocalCopy = true;
		}
		return this;
	};

	registerEmbeddedAssets = (paths: Set<string>) => {
		paths.forEach((path) => {
			this.embeddedAssets.add(path);
		});
		return this;
	};

	getLocalPath = (slug: string) => {
		return this.localSlugs.get(slug);
	};

	registerLocalSlug = (slug: string, path: string) => {
		this.localSlugs.set(slug, path);
		return this;
	};
}
