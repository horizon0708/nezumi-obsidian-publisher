import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import { Asset, FileStatus, FileType, Item, Post } from "./types";
import { uploadAsset, uploadPost } from "src/io/network";
import { cachedRead, readBinary } from "src/io/obsidian-fp";

/**
 * Calls uploadPost with the payload ,
 * updates FileStatus on Failure
 */
const callUploadPost = (post: Post) =>
	pipe(
		post,
		(p: Post) => ({
			type: p.type,
			path: p.serverPath,
			slug: p.slug,
			md5: p.md5,
		}),
		RTE.of,
		RTE.bind("content", () => cachedRead(post.file)),
		RTE.chainW(uploadPost),
		RTE.bimap(
			// TODO: add message depending on error from server
			() => ({ ...post, status: FileStatus.UPLOAD_ERROR } as Item),
			() => ({ ...post, status: FileStatus.UPLOAD_SUCCESS } as Item)
		),
		RTE.orElse((e) => RTE.of(e))
	);

const callUploadAsset = (asset: Asset) =>
	pipe(
		asset,
		(a: Asset) => ({
			type: a.type,
			path: a.serverPath,
			md5: a.md5,
		}),
		RTE.of,
		RTE.bind("content", () => readBinary(asset.file)),
		RTE.chainW(uploadAsset),
		RTE.bimap(
			// TODO: add message depending on error from server
			() => ({ ...asset, status: FileStatus.UPLOAD_ERROR } as Item),
			() => ({ ...asset, status: FileStatus.UPLOAD_SUCCESS } as Item)
		),
		RTE.orElse((e) => RTE.of(e))
	);

const uploadItem = (item: Item) => {
	if (item.type === FileType.POST) {
		return callUploadPost(item);
	}
	return callUploadAsset(item);
};

export const uploadItems = (items: Item[]) =>
	pipe(
		items,
		A.partition((item) => item.status === FileStatus.PENDING),
		(e) => {
			console.log(e);
			return e;
		},
		({ left: skipped, right: pending }) =>
			pipe(
				// Is it worth prioitising post uploads over asset uploads?
				A.map(uploadItem)(pending),
				// sequential for now. Look into batching later.
				// I don't want to run 100s of uploads at once
				RTE.sequenceSeqArray,
				RTE.map((uploaded) => [uploaded, skipped])
			)
	);
