import { flow, pipe } from "fp-ts/lib/function";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as A from "fp-ts/Array";
import * as r from "fp-ts/Record";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import { TFile } from "obsidian";
import { getFileRTE, getFiles_RTE, getFileMd5 } from "src/io/obsidian-fp";
import {
	BaseContext,
	BaseItemBuilder,
	ErroredItem,
	FileStatus,
	Item,
} from "../types";
import {
	FPState,
	markLocalCopy,
	newProcessingState,
	registerEmbeddedAssets,
} from "src/file-processing-state";
import { checkSlugCollision } from "./check-slug-collision";
import { checkMd5Collision } from "./check-md5-collision";
import { Monoid, concatAll } from "fp-ts/lib/Monoid";
import { getFileListFp } from "src/io/network";
import { teeRTE } from "src/utils";

export const planUpload = () =>
	pipe(
		RTE.Do,
		RTE.apS(
			"files",
			pipe(
				getFileListFp,
				RTE.map(({ posts, assets }) => [...posts, ...assets])
			)
		),
		RTE.bind("state", ({ files }) => RTE.of(newProcessingState(files))),
		teeRTE,
		RTE.chainW(({ state }) =>
			pipe(
				getSyncCandidateFiles,
				RTE.chainW(buildItems(state)),
				RTE.map(([errors, items, newState]) => ({
					errors,
					items,
					state: newState as FPState,
				}))
			)
		),
		RTE.chain(({ state, errors, items }) =>
			pipe(
				Array.from(state.embeddedAssets),
				A.map(getFileRTE),
				RTE.sequenceArray,
				RTE.map(A.compact),
				RTE.chain(buildItems(state)),
				RTE.map(([assetErrors, assetItems, newState]) => ({
					errors: errors.concat(assetErrors),
					items: items.concat(assetItems),
					state: newState as FPState,
				}))
			)
		),
		RTE.map((args) => {
			const toDelete: string[] = [];
			args.state.serverPosts.forEach((value, key) => {
				if (!value.hasLocalCopy) {
					toDelete.push(key);
				}
			});
			return { ...args, toDelete };
		})
	);

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
			app.metadataCache.resolvedLinks[file.path] ?? [],
			r.toArray,
			A.filter(([path, n]) => !path.endsWith(".md")),
			A.map(([path, n]) => path),
			(paths) => new Set<string>(paths)
		);

const getMd5RTE = (file: TFile) =>
	pipe(
		file,
		getFileMd5,
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

const callRegisterEmbeddedAssets = (post: { embeddedAssets: Set<string> }) =>
	SRTE.modify((s: FPState) => {
		return registerEmbeddedAssets(s, post.embeddedAssets);
	});

const callMarkLocalCopy = (post: { serverPath: string }) =>
	SRTE.modify((s: FPState) => {
		return markLocalCopy(s, post.serverPath);
	});

const buildItem = (file: TFile) =>
	pipe(
		buildBaseItem(file),
		SRTE.fromReaderTaskEither,
		SRTE.tap((item) => callRegisterEmbeddedAssets(item)),
		SRTE.tap((item) => callMarkLocalCopy(item)),
		SRTE.chainW(checkSlugCollision),
		SRTE.chainW(checkMd5Collision)
	);

type FileProcessResult<E, A> = [E[], A[], "noop" | FPState];
type FPResult = FileProcessResult<ErroredItem, Item>;

const resultMonoid = <E, A>(
	emptyState: FPState
): Monoid<FileProcessResult<E, A>> => ({
	concat: (x, y) => {
		const [xPending, xErrors, xState] = x;
		const [yPending, yErrors, yState] = y;
		const newState = yState === "noop" ? xState : yState;
		return [xPending.concat(yPending), xErrors.concat(yErrors), newState];
	},
	empty: [[], [], emptyState],
});

const buildItems = (state: FPState) => (files: TFile[]) =>
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
		RT.map(concatAll(resultMonoid(state))),
		RT.map((res) => E.right(res))
	);

const getSyncCandidateFiles = pipe(
	RTE.ask<BaseContext>(),
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
