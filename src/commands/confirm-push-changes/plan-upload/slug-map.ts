/**
 *  Wrapper to map slug <-> path
 */
export class SlugMap {
	slugToPath: Map<string, string> = new Map();
	pathToSlug: Map<string, string> = new Map();

	slugToMap: Map<
		string,
		{
			path?: string;
			slug: string;
			serverMd5: string;
			hasLocalCopy: boolean;
		}
	> = new Map();

	constructor() {
		this.slugToPath = new Map();
		this.pathToSlug = new Map();
	}

	set(slug: string, path: string) {
		this.slugToPath.set(slug, path);
		this.pathToSlug.set(path, slug);
	}

	getBySlug(slug: string) {
		return this.slugToPath.get(slug);
	}

	getByPath(path: string) {
		return this.pathToSlug.get(path);
	}

	hasSlug(slug: string) {
		return this.slugToPath.has(slug);
	}

	getPostBySlug(slug: string) {
		const path = this.getBySlug(slug);
		return path && path.endsWith(".md") ? path : undefined;
	}

	hasPath(path: string) {
		return this.pathToSlug.has(path);
	}

	merge(slugMap: SlugMap) {
		slugMap.slugToPath.forEach((path, slug) => {
			this.slugToPath.set(slug, path);
		});
		slugMap.pathToSlug.forEach((slug, path) => {
			this.pathToSlug.set(slug, path);
		});
		return this;
	}
}
