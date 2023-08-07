import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as A from "fp-ts/Array";
import * as O from "fp-ts/Option";
import { Monoid, concatAll } from "fp-ts/Monoid";
import { App, TFile } from "obsidian";
import { flow, pipe } from "fp-ts/function";
import { getFile, getFiles_RTE } from "./obsidian-fp";
import { Blog, ServerFile } from "./types";
import {
	ErroredFile,
	FileProcessingState,
	FileSRTE,
	Post,
	processAsset,
	processPost,
} from "./sync-fs";
import { buildPluginConfig } from "./plugin-config";

type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

type ManifestContext = {
	app: App;
	blog: Blog;
	files: ServerFile[];
	pluginConfig: ReturnType<typeof buildPluginConfig>;
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

const buildProcessor =
	<T>(state: FileProcessingState, deps: ManifestContext, srte: FileSRTE<T>) =>
	(files: TFile[]) => {
		const process = (file: TFile) =>
			pipe(
				srte(state)({ ...deps, file }),
				TE.mapLeft((e) => ({
					...e,
					file,
				})),
				TE.fold(
					(e) => TE.of([[], [e], "noop"] as FileProcessResult<T>),
					([r, s]) => TE.of([[r], [], s] as FileProcessResult<T>)
				),
				RTE.fromTaskEither
			);

		return pipe(
			files,
			A.map(process),
			RTE.sequenceArray,
			RTE.map(concatAll(resultMonoid<T>(state)))
		);
	};

export const emptyFileProcessingState = {
	serverPosts: new Map<string, ServerFileState>(),
	// localPosts: new Map<string, Post>(),
	localSlugs: new Map<string, string>(),
	embeddedAssets: new Set<string>(),
};

type FileProcessResult<T> = [T[], ErroredFile[], FileProcessingState | "noop"];
const resultMonoid = <T>(
	emptyState = emptyFileProcessingState
): Monoid<FileProcessResult<T>> => ({
	concat: (x, y) => {
		const [xPending, xErrors, xState] = x;
		const [yPending, yErrors, yState] = y;
		const newState = yState === "noop" ? xState : yState;
		return [xPending.concat(yPending), xErrors.concat(yErrors), newState];
	},
	empty: [[], [], emptyState],
});

// convert to Either<never, Option> so that we can filter out None values
const getFileOption = flow(
	getFile,
	RTE.fold(
		() => RTE.right(O.none),
		(e) => RTE.right(O.some(e))
	)
);

export const prepareFiles = pipe(
	RTE.Do,
	RTE.bind("deps", () => RTE.ask<ManifestContext>()),
	RTE.bind("state", ({ deps }) =>
		RTE.of({
			...emptyFileProcessingState,
			serverPosts: buildServerFiles(deps.files),
		})
	),
	RTE.chainW(({ deps, state }) => {
		const processToPosts = buildProcessor(state, deps, processPost);
		return pipe(
			getSyncCandidateFiles,
			RTE.chain(processToPosts),
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
	RTE.chainW(({ posts, deps, state }) => {
		const processToAssets = buildProcessor(state, deps, processAsset);
		return pipe(
			Array.from(state.embeddedAssets),
			A.map(getFileOption),
			RTE.sequenceArray,
			RTE.map(A.compact),
			RTE.chain(processToAssets),
			RTE.map(([pending, skipped, newState]) => ({
				posts,
				assets: {
					pending,
					skipped,
				},
				state: newState as FileProcessingState,
			}))
		);
	}),
	RTE.map((args) => {
		const toDelete: string[] = [];
		args.state.serverPosts.forEach((value, key, map) => {
			if (!value.hasLocalCopy) {
				toDelete.push(key);
			}
		});
		return { ...args, toDelete };
	})
);
