import { pipe } from "fp-ts/lib/function";

import {
	Asset,
	FileStatus,
	FileType,
	Item,
	PluginContextC,
	Post,
} from "../../shared/types";
import { cachedRead, readBinary } from "src/shared/obsidian-fp";
import { LogLevel } from "src/shared/plugin-data";
import { A, O, RT, RTE, TE } from "src/shared/fp";
import { NetworkError, SessionMismatchError } from "src/shared/errors";
import { createPost, createAsset } from "src/shared/network-new";
import BlogSync from "main";

export const uploadItems = (items: Item[]) =>
	pipe(
		items,
		A.map(uploadItem),
		// sequential for now. Look into batching later.
		A.sequence(RT.ApplicativeSeq)
	);

const uploadItem = (item: Item) => {
	return pipe(
		getCurrentSessionId(),
		RTE.flatMap(checkItemSession(item)),
		RTE.flatMap(uploadByType),
		RTE.bimap(markSkipsOrFailures(item), () => markFetchSuccess(item)),
		RTE.getOrElse((e: Item) => RT.of(e))
	);
};

const getCurrentSessionId = () =>
	pipe(
		RTE.asks((ctx: PluginContextC) => ctx.plugin),
		RTE.chainTaskEitherKW(getCId)
	);

const getCId = (plugin: BlogSync) =>
	pipe(
		TE.tryCatch(
			() => plugin.currentSession(),
			() => new Error("No session: cancelled")
		),
		TE.chain(TE.fromNullable(new Error("No session: cancelled")))
	);

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
			title: "stub title",
			slug: post.slug,
			md5: post.md5,
			links: post.links,
		},
		RTE.of,
		RTE.bind("markdown", () => cachedRead(post.file)),
		RTE.chainW(createPost),
		RTE.map(() => {})
	);

const callUploadAsset = (asset: Asset) =>
	pipe(
		{
			slug: asset.slug,
			md5: asset.md5,
		},
		RTE.of,
		RTE.bind("content", () => readBinary(asset.file)),
		RTE.chainW(createAsset),
		RTE.map(() => {})
	);
