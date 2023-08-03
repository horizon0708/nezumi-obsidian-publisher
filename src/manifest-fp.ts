import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as A from "fp-ts/Array";
import * as tuples from "fp-ts/Tuple";
import { Semigroup } from "fp-ts/Semigroup";
import { Monoid } from "fp-ts/Monoid";
import { App, TFile } from "obsidian";
import { flow, pipe } from "fp-ts/function";
import { getFiles_RTE } from "./obsidian-fp";
import { Blog, ServerFile } from "./types";
import { ErroredPost, FileProcessingState, Post, processPost } from "./sync-fs";

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

export const getSyncCandidateFiles = pipe(
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

const emptyFileProcessingState = {
	serverPosts: new Map<string, ServerFileState>(),
	localPosts: new Map<string, Post>(),
	localSlugs: new Map<string, string>(),
	embeddedAssets: new Set<string>(),
};

type Result = [Post[], ErroredPost[], FileProcessingState | "noop"];
const resultMonoid: Monoid<Result> = {
	concat: (x, y) => {
		const [xPosts, xErrors, xState] = x;
		const [yPosts, yErrors, yState] = y;
		const newState = yState === "noop" ? xState : yState;
		return [xPosts.concat(yPosts), xErrors.concat(yErrors), newState];
	},
	empty: [[], [], emptyFileProcessingState],
};

const buildServerFiles = (files: ServerFile[]) => {
	const serverPosts = new Map<string, ServerFileState>();
	files.forEach(({ path, md5 }) => {
		serverPosts.set(path, { md5, hasLocalCopy: false });
	});
	return serverPosts;
};

const buildManifestContext = (serverFilesArr: ServerFile[]) =>
	RTE.asks<BlogContext, ManifestContext>((context) => ({
		...context,
		serverPosts: buildServerFiles(serverFilesArr),
	}));

const processFileToPost = (file: TFile) =>
	pipe(
		RTE.ask<ManifestContext>(),
		RTE.chainW(({ serverPosts, app, blog }) =>
			pipe(
				processPost({
					serverPosts,
					localPosts: new Map<string, Post>(),
					localSlugs: new Map<string, string>(),
					embeddedAssets: new Set<string>(),
				})({ app, blog, file }),
				// Hmm I really don't like this
				// I wonder if I was doing something wrong before
				// TE.fold(
				// 	(e) => TE.of([[], [e], "noop"]),
				// 	(r) => TE.of([r, [], "noop"])
				// ),
				RTE.fromTaskEither
			)
		)
	);

export const processManifest = (serverFilesArr: ServerFile[]) =>
	pipe(
		buildManifestContext(serverFilesArr),
		RTE.chain((context) => {
			const processFileTE = pipe(
				getSyncCandidateFiles,
				RTE.chain(flow(A.map(processFileToPost), RTE.sequenceSeqArray))
			)(context);
			return RTE.fromTaskEither(processFileTE);
		}),
		RTE.map(A.foldMap(resultMonoid)(([post, state]) => [[post], state]))
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
