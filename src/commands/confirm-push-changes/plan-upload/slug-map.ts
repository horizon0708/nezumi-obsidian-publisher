/**
 *  Wrapper to map slug <-> path
 */
export class SlugMap {
	private slugToPath: Map<string, string> = new Map();
	private pathToSlug: Map<string, string> = new Map();

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

	hasPath(path: string) {
		return this.pathToSlug.has(path);
	}
}
