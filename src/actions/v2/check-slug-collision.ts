import { FileStatus, Post } from "../types";
import * as O from "fp-ts/Option";

export const checkSlugCollision = (posts: Post[]) => {
	const slugToPath = new Map<string, string>();
	const embeddedAssets = new Set<string>();
	const checked = posts.map((post) => {
		const path = slugToPath.get(post.slug);

		post.embeddedAssets.forEach((asset) => {
			embeddedAssets.add(asset);
		});

		if (path) {
			return {
				...post,
				status: FileStatus.SLUG_COLLISION,
				message: O.some(path),
			};
		}
		return post;
	});

	return [checked, embeddedAssets] as const;
};
