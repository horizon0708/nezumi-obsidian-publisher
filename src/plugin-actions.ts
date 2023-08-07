import { App } from "obsidian";
import { Blog, UploadPostPayload } from "./types";
import { buildPluginConfig } from "./plugin-config";
import { deleteFiles, getFileListFp, uploadAsset, uploadPost } from "./network";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { prepareFiles } from "./manifest-fp";
import { Asset, Post } from "./sync-fs";
import * as A from "fp-ts/Array";
import { Monoid, concatAll } from "fp-ts/lib/Monoid";

type syncFilesParams = {
	blog: Blog;
	app: App;
};

type UploadResult<K> = [K[], K[]];

const successResult = <K>(result: K): UploadResult<K> => [[result], []];
const errorResult = <K>(result: K): UploadResult<K> => [[], [result]];
// There must be a existing monoid similar to this
const resultMonad = <T>(): Monoid<UploadResult<T>> => ({
	concat: (x, y) => {
		const [xSuccess, xError] = x;
		const [ySuccess, yError] = y;
		return [
			[...xSuccess, ...ySuccess],
			[...xError, ...yError],
		];
	},
	empty: [[], []],
});

const callDeleteFiles = (files: string[]) =>
	pipe(
		{ keys: files },
		deleteFiles,
		RTE.chain(() => RTE.of(true)),
		RTE.orElse(() => RTE.of(false))
	);

const uploadPosts = (posts: Post[]) =>
	pipe(
		posts,
		A.map((post) => ({
			type: "post" as const,
			path: post.path,
			content: post.content,
			slug: post.slug,
			md5: post.md5,
		})),
		A.map((p) =>
			pipe(
				uploadPost(p),
				RTE.chain(() => RTE.of(successResult(p))),
				RTE.orElse(() => RTE.of(errorResult(p)))
			)
		),
		// sequentially for now. Look into batching later
		RTE.sequenceSeqArray,
		RTE.map(concatAll(resultMonad())),
		RTE.map(([uploaded, errored]) => ({ uploaded, errored }))
	);

const uploadAssets = (assets: Asset[]) =>
	pipe(
		assets,
		A.map((asset) => ({
			type: "asset" as const,
			path: asset.path,
			content: asset.content,
			md5: asset.md5,
		})),
		A.map((p) =>
			pipe(
				uploadAsset(p),
				RTE.chain(() => RTE.of(successResult(p))),
				RTE.orElse(() => RTE.of(errorResult(p)))
			)
		),
		// sequentially for now. Look into batching later
		RTE.sequenceSeqArray,
		RTE.map(concatAll(resultMonad())),
		RTE.map(([uploaded, errored]) => ({ uploaded, errored }))
	);

export const syncFiles = (params: syncFilesParams) => {
	const pluginConfig = buildPluginConfig();
	const fetchDeps = { ...params, pluginConfig };

	return pipe(
		getFileListFp(fetchDeps),
		TE.map(({ posts, assets }) => [...posts, ...assets]),
		TE.chain((files) => prepareFiles({ ...params, pluginConfig, files })),
		TE.bind("deleteSuccess", ({ toDelete }) =>
			callDeleteFiles(toDelete)(fetchDeps)
		),
		TE.bind("postUploadResult", ({ posts }) =>
			uploadPosts(posts.pending)(fetchDeps)
		),
		TE.map(({ postUploadResult, posts, ...rest }) => ({
			posts: {
				...posts,
				...postUploadResult,
			},
			...rest,
		}))
		// TE.bind("assetUploadResult", ({ assets }) =>
		// 	uploadAssets(assets.pending)(fetchDeps)
		// ),
		// TE.map(({ assetUploadResult, assets, ...rest }) => ({
		// 	assets: {
		// 		...assets,
		// 		...assetUploadResult,
		// 	},
		// 	...rest,
		// }))
	)();
};
