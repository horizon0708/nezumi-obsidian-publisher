import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as A from "fp-ts/Array";
import * as O from "fp-ts/Option";
import { Monoid } from "fp-ts/Monoid";
import { App, TFile } from "obsidian";
import { flow, pipe } from "fp-ts/function";
import { getFile, getFiles_RTE } from "./obsidian-fp";
import { Blog, ServerFile } from "./types";
import {
	Asset,
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

const processFileToPost =
	(state: FileProcessingState, deps: ManifestContext) => (file: TFile) =>
		pipe(
			processPost(state)({ ...deps, file }),
			TE.mapLeft((e) => ({
				...e,
				path: file.path,
			})),
			TE.fold(
				(e) => TE.of([[], [e], "noop"] as Result<Post>),
				([r, s]) => TE.of([[r], [], s] as Result<Post>)
			),
			RTE.fromTaskEither
		);

const processAssetToPost =
	(state: FileProcessingState, deps: ManifestContext) => (file: TFile) =>
		pipe(
			processAsset(state)({ ...deps, file }),
			TE.mapLeft((e) => ({
				...e,
				path: file.path,
			})),
			TE.fold(
				(e) => TE.of([[], [e], "noop"] as Result<Asset>),
				([r, s]) => TE.of([[r], [], s] as Result<Asset>)
			),
			RTE.fromTaskEither
		);

const emptyFileProcessingState = {
	serverPosts: new Map<string, ServerFileState>(),
	localPosts: new Map<string, Post>(),
	localSlugs: new Map<string, string>(),
	embeddedAssets: new Set<string>(),
};

type Result<T> = [T[], ErroredFile[], FileProcessingState | "noop"];
const resultMonoid = <T>(): Monoid<Result<T>> => ({
	concat: (x, y) => {
		const [xPending, xErrors, xState] = x;
		const [yPending, yErrors, yState] = y;
		const newState = yState === "noop" ? xState : yState;
		return [xPending.concat(yPending), xErrors.concat(yErrors), newState];
	},
	empty: [[], [], emptyFileProcessingState],
});

// convert to Either<never, Option> so that we can filter out None values
const getFileOption = flow(
	getFile,
	RTE.fold(
		() => RTE.right(O.none),
		(e) => RTE.right(O.some(e))
	)
);

export const processManifest = pipe(
	RTE.Do,
	RTE.bind("deps", () => RTE.ask<ManifestContext>()),
	RTE.bind("state", ({ deps: { serverPosts } }) =>
		RTE.of({ ...emptyFileProcessingState, serverPosts })
	),
	RTE.chain(({ deps, state }) => {
		const processFile = processFileToPost(state, deps);
		return pipe(
			getSyncCandidateFiles,
			RTE.chain(flow(A.map(processFile), RTE.sequenceArray)),
			RTE.map(A.foldMap(resultMonoid<Post>())((e) => e)),
			RTE.map(([pending, skipped, state]) => ({
				deps,
				posts: {
					pending,
					skipped,
				},
				state: state as FileProcessingState,
			}))
		);
	}),
	RTE.chain(({ posts, deps, state }) => {
		const processFile = processAssetToPost(state, deps);
		return pipe(
			Array.from(state.embeddedAssets),
			A.map(getFileOption),
			RTE.sequenceArray,
			RTE.map(A.compact),
			RTE.chain(flow(A.map(processFile), RTE.sequenceArray)),
			RTE.map(A.foldMap(resultMonoid<Asset>())((e) => e)),
			RTE.map(([pending, skipped, state]) => ({
				posts,
				assets: {
					pending,
					skipped,
				},
				state: state as FileProcessingState,
			}))
		);
	})
);
