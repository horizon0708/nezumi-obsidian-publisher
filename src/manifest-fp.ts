import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as A from "fp-ts/Array";
import { Monoid } from "fp-ts/Monoid";
import { App, TFile } from "obsidian";
import { flow, pipe } from "fp-ts/function";
import { getFile, getFiles_RTE } from "./obsidian-fp";
import { Blog, ServerFile } from "./types";
import {
	ErroredFile,
	FileProcessingState,
	Post,
	processAsset,
	processPost,
} from "./sync-fs";

type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
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

export const buildServerFiles = (files: ServerFile[]) => {
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
					...emptyFileProcessingState,
					serverPosts,
				})({ app, blog, file }),
				TE.mapLeft((e) => ({
					...e,
					path: file.path,
				})),
				TE.fold(
					(e) => TE.of([[], [e], "noop"] as Result),
					([r, s]) => TE.of([[r], [], s] as Result)
				),
				RTE.fromTaskEither
			)
		)
	);

const processAssetToPost = (file: TFile) =>
	pipe(
		RTE.ask<ManifestContext>(),
		RTE.chainW(({ serverPosts, app, blog }) =>
			pipe(
				processAsset({
					...emptyFileProcessingState,
					serverPosts,
				})({ app, blog, file }),
				TE.mapLeft((e) => ({
					...e,
					path: file.path,
				})),
				TE.fold(
					(e) => TE.of([[], [e], "noop"] as Result),
					// NEXT: do I need a new monoid???
					// make result monoid into function so I can pass generic?
					([r, s]) => TE.of([[r], [], s] as Result)
				),
				RTE.fromTaskEither
			)
		)
	);

const emptyFileProcessingState = {
	serverPosts: new Map<string, ServerFileState>(),
	localPosts: new Map<string, Post>(),
	localSlugs: new Map<string, string>(),
	embeddedAssets: new Set<string>(),
};

type Result = [Post[], ErroredFile[], FileProcessingState | "noop"];
const resultMonoid: Monoid<Result> = {
	concat: (x, y) => {
		const [xPosts, xErrors, xState] = x;
		const [yPosts, yErrors, yState] = y;
		const newState = yState === "noop" ? xState : yState;
		return [xPosts.concat(yPosts), xErrors.concat(yErrors), newState];
	},
	empty: [[], [], emptyFileProcessingState],
};

const processFilesToPosts = pipe(
	getSyncCandidateFiles,
	RTE.chain(flow(A.map(processFileToPost), RTE.sequenceArray)),
	RTE.map(A.foldMap(resultMonoid)((e) => e)),
	RTE.map(([posts, errors, state]) => ({
		pendingPosts: posts,
		skippedPosts: errors,
		state: state as FileProcessingState,
	}))
);

export const processManifest = pipe(
	processFilesToPosts,
	RTE.chain((params) =>
		pipe(
			Array.from(params.state.embeddedAssets),
			A.map(getFile),
			RTE.sequenceArray
		)
	)
);
