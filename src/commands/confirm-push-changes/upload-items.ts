import { pipe } from "fp-ts/lib/function";

import { Asset, FileStatus, FileType, Item, Post } from "../../shared/types";
import { uploadAsset, uploadPost } from "src/shared/network";
import { cachedRead, readBinary } from "src/shared/obsidian-fp";
import { getCurrentUploadSessionIdRTE } from "src/shared/plugin-data/upload-session";
import { LogLevel } from "src/shared/plugin-data";
import { A, O, RT, RTE } from "src/shared/fp";
import { NetworkError, SessionMismatchError } from "src/shared/errors";

export const uploadItems = (items: Item[]) =>
	pipe(
		items,
		A.map(uploadItem),
		// sequential for now. Look into batching later.
		A.sequence(RT.ApplicativeSeq)
	);

const uploadItem = (item: Item) => {
	return pipe(
		getCurrentUploadSessionIdRTE,
		RTE.flatMap(checkItemSession(item)),
		RTE.flatMap(uploadByType),
		RTE.bimap(markSkipsOrFailures(item), () => markFetchSuccess(item)),
		RTE.getOrElse((e: Item) => RT.of(e))
	);
};

const checkItemSession = (item: Item) => (currentSessionId: string) =>
	pipe(
		item.sessionId,
		RTE.fromOption(() => new Error("Item has no session ID")),
		RTE.flatMap(
			RTE.fromPredicate(
				(sessionId) => sessionId === currentSessionId,
				(sessionId) =>
					new SessionMismatchError(currentSessionId, sessionId)
			)
		),
		RTE.map(
			(): Item => ({
				...item,
				logs: [
					...item.logs,
					newLog(`Starting upload for ${item.file.path}`, "info"),
				],
			})
		)
	);

const markSkipsOrFailures =
	(item: Item) => (error: Error | SessionMismatchError | NetworkError) => {
		if (error instanceof SessionMismatchError) {
			return {
				...item,
				status: FileStatus.UPLOAD_CANCELLED,
				message: O.some(error.message),
				logs: [...item.logs, newLog(error.message, "info")],
			};
		}
		return {
			...item,
			status: FileStatus.UPLOAD_ERROR,
			message: O.some(error.message),
			logs: [...item.logs, newLog(error.message, "error")],
		};
	};

const markFetchSuccess = (item: Item) => ({
	...item,
	status: FileStatus.UPLOAD_SUCCESS,
	logs: [...item.logs, newLog(`[UPLOAD SUCCESS] ${item.file.path}`, "error")],
});

const newLog = (message: string, level: LogLevel = "info") => ({
	timestamp: new Date().toISOString(),
	message,
	level,
});

const uploadByType = (item: Item) => {
	return item.type === FileType.POST
		? callUploadPost(item)
		: callUploadAsset(item);
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
			links: post.links,
		},
		RTE.of,
		RTE.bind("content", () => cachedRead(post.file)),
		RTE.chainW(uploadPost),
		RTE.map(() => {})
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
		RTE.map(() => {})
	);
