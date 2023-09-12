import { E } from "src/shared/fp";
import { TFile } from "obsidian";
import { SlugCollisionError } from "src/shared/errors";
import { Manifest } from "src/commands/confirm-push-changes/plan-upload/manifest";

interface HasSlug {
	slug: string;
	file: TFile;
}

export const checkSlugCollision =
	(slugMap: Manifest) =>
	<T extends HasSlug>(pFile: T) => {
		const { slug, file } = pFile;
		const post = slugMap.getPostBySlug(slug);
		if (post && !!post.path) {
			return E.left(new SlugCollisionError(file, post.path));
		}
		return E.right(pFile);
	};
