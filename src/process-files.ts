import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as A from "fp-ts/Array";
import { flow, pipe } from "fp-ts/function";
import {
	getSlugFromFrontmatter,
	getDefaultSlugFromFile,
	updateSlug,
	readPost,
	getEmbeddedAssets,
	readAsset,
} from "./obsidian-fp";
import SparkMD5 from "spark-md5";
import { App, TFile } from "obsidian";
import { buildPluginConfig } from "./plugin-config";
import { Blog } from "./network";
import { Monoid, concatAll } from "fp-ts/lib/Monoid";

type ServerPosts = Map<string, ServerFileState>;
type LocalSlugs = Map<string, string>;

type FileProcessingContext = {
	app: App;
	blog: Blog;
	file: TFile;
	pluginConfig: ReturnType<typeof buildPluginConfig>;
};

enum FileStatus {
	NOOP = "NOOP",
	PENDING = "PENDING",
	SLUG_UPDATE_ERROR = "SKIP/SLUG_UPDATE_ERROR",
	SLUG_COLLISION = "SKIP/SLUG_COLLISION",
	MD5_COLLISION = "SKIP/MD5_COLLISION",
	READ_ERROR = "SKIP/READ_ERROR",
	PENDING_UPLOAD = "UPLOAD/PENDING",
}

export type Post = {
	slug: string;
	path: string;
	content: string;
	md5: string;
	serverMd5: string;
	embeddedAssets: Set<string>;
	status: FileStatus;
};

export type Asset = {
	path: string;
	content: ArrayBuffer;
	md5: string;
	serverMd5: string;
	status: FileStatus;
};

export type ErroredFile = {
	status: FileStatus;
	conflictsWith?: string;
	file?: TFile;
};

type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

export type FileProcessingState = {
	serverPosts: ServerPosts;
	// localPosts: LocalPosts;
	localSlugs: LocalSlugs;
	embeddedAssets: Set<string>;
};
export const emptyFileProcessingState = (): FileProcessingState => ({
	serverPosts: new Map<string, ServerFileState>(),
	// localPosts: new Map<string, Post>(),
	localSlugs: new Map<string, string>(),
	embeddedAssets: new Set<string>(),
});

// Post paths are saved without the sync folder in server
// Assets paths are full paths, so we can't strip out the sync folder
const getServerPath = (path: string) => (syncFolder: string) => {
	if (!path.endsWith(".md")) {
		return path;
	}
	return syncFolder === "/" ? path : path.slice(syncFolder.length + 1);
};

const getSlug = pipe(
	RTE.Do,
	RTE.apS("fmSlug", getSlugFromFrontmatter),
	RTE.apS("defaultSlug", getDefaultSlugFromFile),
	RTE.map(({ fmSlug, defaultSlug }) => fmSlug || defaultSlug)
);

const maybeUpdateSlugInFrontmatter = (slug: string) =>
	pipe(
		RTE.Do,
		RTE.apS("fmSlug", getSlugFromFrontmatter),
		RTE.tap(({ fmSlug }) => {
			if (!fmSlug) {
				return;
			}
			return updateSlug(slug);
		}),
		RTE.mapLeft(() => ({ status: FileStatus.SLUG_UPDATE_ERROR }))
	);

const getServerMd5ForPost = (state: FileProcessingState) =>
	RTE.asks((deps: FileProcessingContext) => {
		const serverPath = getServerPath(deps.file.path)(deps.blog.syncFolder);
		return state.serverPosts.get(serverPath)?.md5 ?? "";
	});

const registerLocalSlug =
	(slug: string, path: string) => (s: FileProcessingState) => {
		s.localSlugs.set(slug, path);
		return s;
	};

const markServerPostAsHavingLocalCopy =
	(serverPath: string) => (state: FileProcessingState) => {
		const sp = state.serverPosts.get(serverPath);
		if (sp) {
			sp.hasLocalCopy = true;
		}
		return state;
	};

const getPath = RTE.asks((deps: FileProcessingContext) =>
	getServerPath(deps.file.path)(deps.blog.syncFolder)
);

const checkMd5Collision = (serverMd5: string, md5: string) => {
	if (serverMd5 && serverMd5 === md5) {
		return RTE.left({ status: FileStatus.MD5_COLLISION });
	}
	return RTE.right("noop");
};

export type FileSRTE<T> = SRTE.StateReaderTaskEither<
	FileProcessingState,
	FileProcessingContext,
	ErroredFile,
	T
>;

export const processPost: FileSRTE<Post> = pipe(
	SRTE.get<FileProcessingState, FileProcessingContext>(),
	SRTE.chainReaderTaskEitherK((state) =>
		pipe(
			RTE.Do,
			RTE.apSW("status", RTE.of(FileStatus.PENDING)),
			RTE.apSW("path", getPath),
			RTE.apSW("embeddedAssets", getEmbeddedAssets),
			RTE.tap(({ embeddedAssets }) => {
				embeddedAssets.forEach((path) => {
					state.embeddedAssets.add(path);
				});
				return RTE.of("");
			}),
			RTE.apSW("slug", getSlug),
			RTE.tap(({ slug }) => maybeUpdateSlugInFrontmatter(slug)),
			RTE.chain((params) => {
				const anotherPath = state.localSlugs.get(params.slug);
				return anotherPath
					? RTE.left({
							status: FileStatus.SLUG_COLLISION,
							conflictsWith: anotherPath,
					  })
					: RTE.right(params);
			}),
			RTE.tap((param) =>
				pipe(registerLocalSlug(param.slug, param.path)(state), RTE.of)
			),
			RTE.apSW("serverMd5", getServerMd5ForPost(state)),
			RTE.tap((param) =>
				pipe(markServerPostAsHavingLocalCopy(param.path)(state), RTE.of)
			),
			RTE.apSW(
				"content",
				pipe(
					readPost,
					RTE.mapLeft(() => ({ status: FileStatus.READ_ERROR }))
				)
			),
			RTE.bindW("md5", (params) => RTE.of(SparkMD5.hash(params.content))),
			RTE.tap((params) => checkMd5Collision(params.serverMd5, params.md5))
		)
	)
);

export const processAsset: FileSRTE<Asset> = pipe(
	SRTE.get<FileProcessingState, FileProcessingContext>(),
	SRTE.chainReaderTaskEitherK((state) =>
		pipe(
			RTE.Do,
			RTE.apSW("status", RTE.of(FileStatus.PENDING)),
			RTE.apSW("path", getPath),
			RTE.apSW("serverMd5", getServerMd5ForPost(state)),
			RTE.tap((param) =>
				pipe(markServerPostAsHavingLocalCopy(param.path)(state), RTE.of)
			),
			RTE.apSW(
				"content",
				pipe(
					readAsset,
					RTE.mapLeft(() => ({ status: FileStatus.READ_ERROR }))
				)
			),
			RTE.bindW("md5", (params) =>
				RTE.of(SparkMD5.ArrayBuffer.hash(params.content))
			),
			RTE.tap((params) => checkMd5Collision(params.serverMd5, params.md5))
		)
	)
);

type FileProcessResult<T> = [T[], ErroredFile[], FileProcessingState | "noop"];
const resultMonoid = <T>(
	emptyState = emptyFileProcessingState()
): Monoid<FileProcessResult<T>> => ({
	concat: (x, y) => {
		const [xPending, xErrors, xState] = x;
		const [yPending, yErrors, yState] = y;
		const newState = yState === "noop" ? xState : yState;
		return [xPending.concat(yPending), xErrors.concat(yErrors), newState];
	},
	empty: [[], [], emptyState],
});

export const buildProcessor =
	<T>(
		state: FileProcessingState,
		deps: Omit<FileProcessingContext, "file">,
		srte: FileSRTE<T>
	) =>
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
