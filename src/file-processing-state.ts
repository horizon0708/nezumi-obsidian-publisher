import * as O from "fp-ts/Option";
import { ServerFile } from "./io/network";
type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

export type FPState = ReturnType<typeof emptyState>;

export const emptyState = () => ({
	serverPosts: new Map<string, ServerFileState>(),
	localSlugs: new Map<string, string>(),
	embeddedAssets: new Set<string>(),
});

export const newProcessingState = (files: ServerFile[]) => {
	const serverPosts = new Map<string, ServerFileState>();
	files.forEach(({ path, md5 }) => {
		serverPosts.set(path, { md5, hasLocalCopy: false });
	});

	return {
		...emptyState(),
		serverPosts,
	};
};

export const registerLocalCopy = (s: FPState, path: string) => {
	const sp = s.serverPosts.get(path);
	if (sp) {
		sp.hasLocalCopy = true;
	}
	return s;
};

export const getServerMd5 = (s: FPState, path: string) => {
	const sp = s.serverPosts.get(path);
	return O.fromNullable(sp?.md5);
};

export const markLocalCopy = (s: FPState, path: string) => {
	const sp = s.serverPosts.get(path);
	if (sp) {
		sp.hasLocalCopy = true;
	}
	return s;
};

export const registerEmbeddedAssets = (s: FPState, paths: Set<string>) => {
	paths.forEach((path) => {
		s.embeddedAssets.add(path);
	});
	return s;
};

export const getLocalPath = (s: FPState, slug: string) => {
	return s.localSlugs.get(slug);
};

export const registerLocalSlug = (s: FPState, slug: string, path: string) => {
	s.localSlugs.set(slug, path);
	return s;
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

	populateServerPosts = (files: ServerFile[]) => {
		this.serverPosts = new Map<string, ServerFileState>();
		this.localSlugs = new Map<string, string>();
		this.embeddedAssets = new Set<string>();
		files.forEach(({ path, md5 }) => {
			this.serverPosts.set(path, { md5, hasLocalCopy: false });
		});
		return this;
	};

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
