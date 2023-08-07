import { App } from "obsidian";
import { buildPluginConfig } from "./plugin-config";
import {
	Blog,
	deleteFiles,
	getFileListFp,
	uploadAsset,
	uploadPost,
} from "./network";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { buildManifest } from "./build-manifest";
import { Asset, Post } from "./process-files";
import * as A from "fp-ts/Array";
import { Monoid, concatAll } from "fp-ts/lib/Monoid";
import { errorResultM, resultM, successResultM } from "./utils";

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
				RTE.chain(() => RTE.of(successResultM(p))),
				RTE.orElse(() => RTE.of(errorResultM(p)))
			)
		),
		// sequentially for now. Look into batching later
		RTE.sequenceSeqArray,
		RTE.map(concatAll(resultM())),
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
				RTE.chain(() => RTE.of(successResultM(p))),
				RTE.orElse(() => RTE.of(errorResultM(p)))
			)
		),
		// sequentially for now. Look into batching later
		RTE.sequenceSeqArray,
		RTE.map(concatAll(resultM())),
		RTE.map(([uploaded, errored]) => ({ uploaded, errored }))
	);

type syncFilesParams = {
	blog: Blog;
	app: App;
};
export const syncFiles = (params: syncFilesParams) => {
	const pluginConfig = buildPluginConfig();
	const fetchDeps = { ...params, pluginConfig };

	return pipe(
		getFileListFp(fetchDeps),
		TE.map(({ posts, assets }) => [...posts, ...assets]),
		TE.chain((files) => buildManifest({ ...params, pluginConfig, files })),
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
		})),
		TE.bind("assetUploadResult", ({ assets }) =>
			uploadAssets(assets.pending)(fetchDeps)
		),
		TE.map(({ assetUploadResult, assets, ...rest }) => ({
			assets: {
				...assets,
				...assetUploadResult,
			},
			...rest,
		}))
	)();
};
