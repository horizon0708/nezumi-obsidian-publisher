import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as A from "fp-ts/Array";
import { Asset, FileStatus, FileType, Item, Post } from "../../shared/types";
import { uploadAsset, uploadPost } from "src/shared/network";
import { cachedRead, readBinary } from "src/shared/obsidian-fp";
import { getCurrentUploadSessionIdRTE } from "src/shared/plugin-data/upload-session";
import { logForSession } from "src/shared/plugin-data";

export const uploadItems = (items: Item[]) =>
	pipe(
		RT.of(items),
		RT.tap(() => logForSession(`Starting upload ${items.length} items.`)),
		RTE.rightReaderTask,
		RTE.map(A.map(uploadItem)),
		RTE.chain(RTE.sequenceSeqArray),
		// sequential for now. Look into batching later.
		// I don't want to run 100s of uploads at once
		RTE.tap((uploaded) =>
			pipe([...uploaded], A.map(logUploadResult), RTE.sequenceSeqArray)
		)
		// A.partition((item) => item.status === FileStatus.PENDING),
		// ({ left: skipped, right: pending }) =>
		// 	pipe(
		// 		logForSession(
		// 			`Starting upload ${pending.length} items.`
		// 		),
		// 		RTE.rightReaderTask,
		// 		// Is it worth prioitising post uploads over asset uploads?
		// 		RTE.chainW(() =>
		// 			pipe(A.map(uploadItem)(pending), RTE.sequenceSeqArray)
		// 		),
		// 		// sequential for now. Look into batching later.
		// 		// I don't want to run 100s of uploads at once
		// 		RTE.tap((uploaded) =>
		// 			pipe(
		// 				[...uploaded],
		// 				A.map(logUploadResult),
		// 				RTE.sequenceSeqArray
		// 			)
		// 		),
		// 		RTE.map((uploaded) => [uploaded, skipped])
		// 	)
	);

const uploadItem = (item: Item) => {
	const upload = (item: Item) => {
		return item.type === FileType.POST
			? callUploadPost(item)
			: callUploadAsset(item);
	};
	const cancelledItem = setItemStatus(FileStatus.UPLOAD_CANCELLED)(item);

	const checkSessionEqual = RTE.fromPredicate(
		(sessionId: string) => item.sessionId === sessionId,
		() => cancelledItem
	);

	return pipe(
		getCurrentUploadSessionIdRTE,
		RTE.mapLeft(() => cancelledItem),
		RTE.chainW(checkSessionEqual),
		RTE.tapReaderTask(() =>
			logForSession(`Uploading ${item.file.path}...`)
		),
		RTE.chainW(() => upload(item)),
		// RTE.tapTaskEither(() => delayTE(5000)),
		RTE.orElse((e) => RTE.of(e))
		// RTE.tapIO((item) => () => console.log(`uploaded ${item.serverPath}`))
	);
};

/**
 * Calls uploadPost with the payload ,
 * updates FileStatus on Failure
 */
const callUploadPost = (post: Post) =>
	pipe(
		{
			type: post.type,
			path: post.serverPath,
			slug: post.slug,
			md5: post.md5,
		},
		RTE.of,
		RTE.bind("content", () => cachedRead(post.file)),
		RTE.chainW(uploadPost),
		RTE.bimap(
			// TODO: add message depending on error from server
			() => setItemStatus(FileStatus.UPLOAD_ERROR)(post),
			() => setItemStatus(FileStatus.UPLOAD_SUCCESS)(post)
		),
		RTE.orElse((e) => RTE.of(e))
	);

const callUploadAsset = (asset: Asset) =>
	pipe(
		{
			type: asset.type,
			path: asset.serverPath,
			md5: asset.md5,
		},
		RTE.of,
		RTE.bind("content", () => readBinary(asset.file)),
		RTE.chainW(uploadAsset),
		RTE.bimap(
			// TODO: add message depending on error from server
			() => setItemStatus(FileStatus.UPLOAD_ERROR)(asset),
			() => setItemStatus(FileStatus.UPLOAD_SUCCESS)(asset)
		),
		RTE.orElse((e) => RTE.of(e))
	);

const logUploadResult = (item: Item) =>
	pipe(item, buildLog, logForSession, RTE.rightReaderTask);

const buildLog = (item: Item) => {
	switch (item.status) {
		case FileStatus.UPLOAD_SUCCESS:
			return `uploaded ${item.file.path}`;
		case FileStatus.UPLOAD_ERROR:
			return `upload failed ${item.file.path}`;
		case FileStatus.UPLOAD_CANCELLED:
			return `upload cancelled ${item.file.path}`;
		case FileStatus.SLUG_UPDATE_ERROR:
			return `ERROR: slug update failed ${item.file.path}`;
		case FileStatus.READ_ERROR:
			return `ERROR: read error ${item.file.path}`;
		case FileStatus.SLUG_COLLISION:
			return `SKIP: slug collision ${item.file.path}`;
		case FileStatus.MD5_COLLISION:
			return `SKIP: md5 collision ${item.file.path}`;
		case FileStatus.NOOP:
		case FileStatus.PENDING:
			return `ERROR: unexpected status ${item.file.path} ${item.status}`;
	}
};

const setItemStatus =
	(status: FileStatus) =>
	(item: Item): Item => ({
		...item,
		status,
	});
