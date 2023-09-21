import { TFile } from "obsidian";
import { ServerFile } from "src/shared/network-new";

/**
 *  Wrapper to map slug <-> path
 */
interface HasMd5 {
	file: TFile;
	slug: string;
	md5: string;
}

type ManifestItem = {
	slug: string;
	path?: string;
	serverMd5?: string;
};

export class Manifest {
	// used to resolve internal links to slug
	pathToSlug: Map<string, string> = new Map();

	// used to check for duplicates, slugs to delete from the server
	slugToPost: Map<string, ManifestItem> = new Map();
	slugToAsset: Map<string, ManifestItem> = new Map();

	constructor(posts: ServerFile[], assets: ServerFile[]) {
		posts.forEach(({ slug, md5 }) => {
			slug &&
				this.slugToPost.set(slug, {
					serverMd5: md5,
					slug,
				});
		});
		assets.forEach(({ slug, md5 }) => {
			slug &&
				this.slugToAsset.set(slug, {
					serverMd5: md5,
					slug,
				});
		});
	}

	registerLocalSlug(slug: string, file: TFile) {
		this.pathToSlug.set(file.path, slug);
		const map =
			file.extension === "md" ? this.slugToPost : this.slugToAsset;

		const item = map.get(slug);
		if (item) {
			// setting ths path means that the file exists locally
			item.path = file.path;
			return;
		}
		map.set(slug, { slug, path: file.path });
	}

	getPostBySlug(slug: string) {
		return this.slugToPost.get(slug);
	}

	hasSameMd5({ slug, file, md5 }: HasMd5) {
		const map =
			file.extension === "md" ? this.slugToPost : this.slugToAsset;
		const item = map.get(slug);

		return item?.serverMd5 && item.serverMd5 === md5;
	}

	get getItemsToDelete() {
		return {
			posts: Array.from(this.slugToPost.values()).filter((x) => !x.path),
			assets: Array.from(this.slugToAsset.values()).filter(
				(x) => !x.path
			),
		};
	}
}
