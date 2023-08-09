import { flow, pipe } from "fp-ts/lib/function";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as A from "fp-ts/Array";
import * as r from "fp-ts/Record";
import * as O from "fp-ts/Option";
import { TFile } from "obsidian";
import { getFileRT, getFiles_RT, getMd52 } from "src/io/obsidian-fp";
import {
	BaseContext,
	BaseItemBuilder,
	ErroredItem,
	FileStatus,
	Item,
} from "../types";
import { FileProcessingStateImpl } from "src/file-processing-state";
import { checkSlugCollision } from "./check-slug-collision";
import { checkMd5Collision } from "./check-md5-collision";
import { Monoid, concatAll } from "fp-ts/lib/Monoid";
import { ServerFile, getFileListFp } from "src/io/network";

const getServerPath = (path: string) => (syncFolder: string) => {
	if (!path.endsWith(".md")) {
		return path;
	}
	return syncFolder === "/" ? path : path.slice(syncFolder.length + 1);
};

const getEmbeddedAssets =
	(file: TFile) =>
	({ app }: BaseContext) =>
		pipe(
			app.metadataCache.resolvedLinks[file.path],
			r.toArray,
			A.filter(([path, n]) => !path.endsWith(".md")),
			A.map(([path, n]) => path),
			(paths) => new Set<string>(paths)
		);

const getMd5RTE = (file: TFile) =>
	pipe(
		file,
		getMd52,
		RTE.mapLeft(() => ({
			file,
			status: FileStatus.READ_ERROR,
			message: O.none,
		}))
	);

const buildBaseItem: BaseItemBuilder = (file) =>
	pipe(
		RTE.asks((deps: BaseContext) => ({
			file,
			status: FileStatus.PENDING,
			serverPath: getServerPath(file.path)(deps.blog.syncFolder),
			serverMd5: O.none,
			message: O.none,
			embeddedAssets: getEmbeddedAssets(file)(deps),
		})),
		RTE.apS("md5", getMd5RTE(file))
	);

const registerEmbeddedAssets = (post: { embeddedAssets: Set<string> }) =>
	SRTE.modify((s: FileProcessingStateImpl) => {
		return s.registerEmbeddedAssets(post.embeddedAssets);
	});

const markLocalCopy = (post: { serverPath: string }) =>
	SRTE.modify((s: FileProcessingStateImpl) => {
		return s.markLocalCopy(post.serverPath);
	});

const buildItem = (file: TFile) =>
	pipe(
		buildBaseItem(file),
		SRTE.fromReaderTaskEither,
		SRTE.tap((item) => registerEmbeddedAssets(item)),
		SRTE.tap((item) => markLocalCopy(item)),
		SRTE.chainW(checkSlugCollision),
		SRTE.chainW(checkMd5Collision)
	);

// type FileProcessResult<E, A> = [E[], [], "noop"] | [[], A[], FileProcessingStateImpl]
type FileProcessResult<E, A> = [E[], A[], "noop" | FileProcessingStateImpl];
type FPResult = FileProcessResult<ErroredItem, Item>;

const resultMonoid = <E, A>(
	emptyState: FileProcessingStateImpl
): Monoid<FileProcessResult<E, A>> => ({
	concat: (x, y) => {
		const [xPending, xErrors, xState] = x;
		const [yPending, yErrors, yState] = y;
		const newState = yState === "noop" ? xState : yState;
		return [xPending.concat(yPending), xErrors.concat(yErrors), newState];
	},
	empty: [[], [], emptyState],
});

const buildItems =
	<T>(state: FileProcessingStateImpl) =>
	(files: TFile[]) =>
		pipe(
			files,
			A.map((file) =>
				pipe(
					buildItem(file)(state),
					RTE.fold(
						(e) => RT.of([[e], [], "noop"] as FPResult),
						([a, s]) => RT.of([[], [a], s] as FPResult)
					)
				)
			),
			RT.sequenceArray,
			RT.map(concatAll(resultMonoid(state)))
		);

const getSyncCandidateFiles = pipe(
	RT.ask<BaseContext>(),
	RT.chainW(({ blog: { syncFolder } }) =>
		pipe(
			getFiles_RT,
			RT.map(
				flow(
					A.filter((file) => file.path.endsWith(".md")),
					A.filter((file) => file.path.startsWith(syncFolder))
				)
			)
		)
	)
);

export const planUpload = (files: ServerFile[]) =>
	pipe(
		RT.Do,
		RT.apS(
			"files",
			pipe(
				getFileListFp,
				// TODO: This whole thing (plan upload should be RTE)
				// as this could fail
				RTE.map(({ posts, assets }) => [...posts, ...assets]),
				RTE.fold(
					() => RT.of([]),
					(serverFiles) => RT.of(serverFiles)
				)
			)
		),
		RT.bind("state", ({ files }) =>
			RT.of(new FileProcessingStateImpl(files))
		),
		RT.chainW(({ state }) =>
			pipe(
				getSyncCandidateFiles,
				RT.chain(buildItems(state)),
				RT.map(([errors, items, newState]) => ({
					errors,
					items,
					state: newState as FileProcessingStateImpl,
				}))
			)
		),
		RT.chain(({ state, errors, items }) =>
			pipe(
				Array.from(state.embeddedAssets),
				A.map(getFileRT),
				RT.sequenceArray,
				RT.map(A.compact),
				RT.chain(buildItems(state)),
				RT.map(([assetErrors, assetItems, newState]) => ({
					errors: errors.concat(assetErrors),
					items: items.concat(assetItems),
					state: newState as FileProcessingStateImpl,
				}))
			)
		),
		RT.map((args) => {
			const toDelete: string[] = [];
			args.state.serverPosts.forEach((value, key) => {
				if (!value.hasLocalCopy) {
					toDelete.push(key);
				}
			});
			return { ...args, toDelete };
		})
	);
