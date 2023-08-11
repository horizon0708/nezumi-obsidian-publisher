import { FileStatus, Item, Post } from "../types";
import * as O from "fp-ts/Option";

export const markPostsWithCollidingSlugs = (posts: Post[]) => {
	const slugToPath = new Map<string, string>();
	return posts.map((post) => {
		const path = slugToPath.get(post.slug);
		if (path) {
			return {
				...post,
				status: FileStatus.SLUG_COLLISION,
				message: O.some(path),
			};
		}
		return post;
	});
};

type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

export const checkMd5Collision2 =
	(serverFiles: Map<string, ServerFileState>) => (items: Item[]) => {
		const processed = items.map((item) => {
			const serverFile = serverFiles.get(item.serverPath);
			if (serverFile) {
				serverFile.hasLocalCopy = true;
			}

			if (serverFile && serverFile.md5 === item.md5) {
				return {
					...item,
					status: FileStatus.MD5_COLLISION,
				};
			}
			return item;
		});

		const toDelete: string[] = [];
		serverFiles.forEach((value, key) => {
			if (!value.hasLocalCopy) {
				toDelete.push(key);
			}
		});

		return [processed, toDelete] as const;
	};
