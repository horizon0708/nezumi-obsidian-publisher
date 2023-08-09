import { App } from "obsidian";
import { buildPluginConfig } from "./plugin-config";
import {
	Blog,
	deleteFiles,
	getFileListFp,
	uploadAssets,
	uploadPosts,
} from "./io/network";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { buildManifest } from "./build-manifest";
import * as A from "fp-ts/Array";

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
			pipe(
				{ keys: toDelete },
				deleteFiles,
				RTE.chain(() => RTE.of(true)),
				RTE.orElse(() => RTE.of(false))
			)(fetchDeps)
		),
		TE.bind("postUploadResult", ({ posts }) =>
			pipe(
				posts.pending,
				A.map((post) => ({
					type: "post" as const,
					path: post.path,
					content: post.content,
					slug: post.slug,
					md5: post.md5,
				})),
				uploadPosts
			)(fetchDeps)
		),
		TE.map(({ postUploadResult, posts, ...rest }) => ({
			posts: {
				...posts,
				...postUploadResult,
			},
			...rest,
		})),
		TE.bind("assetUploadResult", ({ assets }) =>
			pipe(
				assets.pending,
				A.map((asset) => ({
					type: "asset" as const,
					path: asset.path,
					content: asset.content,
					md5: asset.md5,
				})),
				uploadAssets
			)(fetchDeps)
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
