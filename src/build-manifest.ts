import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import * as O from "fp-ts/Option";
import { App } from "obsidian";
import { flow, pipe } from "fp-ts/function";
import { getFile, getFiles_RTE } from "./obsidian-fp";
import {
	FileProcessingState,
	buildProcessMany,
	emptyFileProcessingState,
	processAsset,
	processPost,
} from "./process-files";
import { buildPluginConfig } from "./plugin-config";
import { Blog, ServerFile } from "./network";

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

const getSyncCandidateFiles = pipe(
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

const buildServerFiles = (files: ServerFile[]) => {
	const serverPosts = new Map<string, ServerFileState>();
	files.forEach(({ path, md5 }) => {
		serverPosts.set(path, { md5, hasLocalCopy: false });
	});
	return serverPosts;
};

// convert to Either<never, Option> so that we can filter out None values
const getFileOption = flow(
	getFile,
	RTE.fold(
		() => RTE.right(O.none),
		(e) => RTE.right(O.some(e))
	)
);

export const buildManifest = pipe(
	RTE.Do,
	RTE.bind("deps", () => RTE.ask<ManifestContext>()),
	RTE.bind("state", ({ deps }) =>
		RTE.of({
			...emptyFileProcessingState(),
			serverPosts: buildServerFiles(deps.files),
		})
	),
	RTE.chainW(({ deps, state }) => {
		const processToPosts = buildProcessMany(state, deps, processPost);
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
		const processToAssets = buildProcessMany(state, deps, processAsset);
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
