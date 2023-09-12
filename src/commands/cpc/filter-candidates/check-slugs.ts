import { E, pipe } from "src/shared/fp";
import { SlugMap } from "../../confirm-push-changes/plan-upload/slug-map";
import { TFile } from "obsidian";
import { FileProcessingError, SlugCollisionError } from "src/shared/errors";
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
			console.log(slugMap.slugToPost);
			console.log(slug, file.path, post.path);
			// TODO: pass the path to the error
			return E.left(new SlugCollisionError(file, post.path));
		}
		console.log("register", slug, file.path);
		slugMap.registerLocalSlug(slug, file);
		return E.right(pFile);
	};
