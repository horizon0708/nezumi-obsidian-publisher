import * as O from "fp-ts/Option";
type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

export class FileProcessingStateImpl {
	serverPosts: Map<string, ServerFileState>;
	localSlugs: Map<string, string>;
	embeddedAssets: Set<string>;

	constructor() {
		this.serverPosts = new Map<string, ServerFileState>();
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
		// IDK why it types to only ServerFileState
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
