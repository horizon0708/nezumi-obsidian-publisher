import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import { App, TFile } from "obsidian";
import { flow, pipe } from "fp-ts/function";
import { getFiles_RTE } from "./obsidian-fp";
import { Blog, ServerFile } from "./types";
import { processPost } from "./sync-fs";
import { get } from "http";

type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

type BlogContext = {
	app: App;
	blog: Blog;
};

type ManifestContext = {
	app: App;
	blog: Blog;
	serverPosts: Map<string, ServerFileState>;
};

export const getFilesToBeSynced_RTE = pipe(
	RTE.ask<{ blog: Blog }>(),
	RTE.chainW(({ blog: { syncFolder } }) =>
		pipe(
			getFiles_RTE,
			RTE.map(
				flow(
					A.filter((file) => file.path.endsWith(".md")),
					A.filter((file) => file.path.startsWith(syncFolder))
				)
			)
			// flatmap?
		)
	)
);

const buildServerFiles = (files: ServerFile[]) => {
	const serverPosts = new Map<string, ServerFileState>();
	files.forEach(({ path, md5 }) => {
		serverPosts.set(path, { md5, hasLocalCopy: false });
	});
	return serverPosts;
};

const processFileToPost = (file: TFile) =>
	pipe(
		RTE.ask<ManifestContext>(),
		RTE.chainW(({ serverPosts, app, blog }) =>
			pipe(
				processPost({
					serverPosts,
					localPosts: new Map<string, Record<string, string>>(),
					localSlugs: new Map<string, string>(),
					embeddedAssets: new Set<string>(),
				})({ app, blog, file }),
				RTE.fromTaskEither
			)
		)
	);

const buildManifestContext = (serverFilesArr: ServerFile[]) =>
	RTE.asks<BlogContext, ManifestContext>((context) => ({
		...context,
		serverPosts: buildServerFiles(serverFilesArr),
	}));

export const processManifest = (serverFilesArr: ServerFile[]) =>
	pipe(
		buildManifestContext(serverFilesArr),
		RTE.chain((context) => {
			const processFileTE = pipe(
				getFilesToBeSynced_RTE,
				RTE.chain(flow(A.map(processFileToPost), RTE.sequenceArray))
			)(context);
			return RTE.fromTaskEither(processFileTE);
		})

		// getFilesToBeSynced_RTE,
		// RTE.chainW(flow(A.map(processFileToPost), RTE.sequenceArray))
	);

// equivalent to above - leaving it for posterity/ study later
const getFiles_SRTE_flipped = pipe(
	getFiles_RTE,
	RTE.chainW((files) =>
		pipe(
			RTE.asks((deps: ManifestContext) => deps.blog.syncFolder),
			RTE.map(
				flow(
					(syncFolder) =>
						A.filter<TFile>((file) =>
							file.path.startsWith(syncFolder)
						)(files),
					A.filter((file) => file.path.endsWith(".md"))
				)
			)
		)
	)
);
