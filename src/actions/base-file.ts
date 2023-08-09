import { App, TFile } from "obsidian";
import * as O from "fp-ts/Option";
import * as R from "fp-ts/Reader";
import * as RE from "fp-ts/ReaderEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as r from "fp-ts/Record";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { Blog } from "src/io/network";
import { buildPluginConfig } from "src/plugin-config";
import { liftRightRE, liftRightE } from "src/utils";
import { getMd5, getMd52 } from "src/io/obsidian-fp";
import { FileProcessingStateImpl } from "src/file-processing-state";

export enum FileStatus {
	NOOP = "NOOP",
	PENDING = "PENDING",
	SLUG_UPDATE_ERROR = "SKIP/SLUG_UPDATE_ERROR",
	SLUG_COLLISION = "SKIP/SLUG_COLLISION",
	MD5_COLLISION = "SKIP/MD5_COLLISION",
	READ_ERROR = "SKIP/READ_ERROR",
	PENDING_UPLOAD = "UPLOAD/PENDING",
}

export enum FileType {
	POST = "post",
	ASSET = "asset",
}

/**
 * Base File type that is common to all file types regardless of success or failure
 * @param file
 * @returns
 */
export type Item = {
	file: TFile;
	status: FileStatus;
	serverPath: string;
	md5: string;
	embeddedAssets: Set<string>;
	serverMd5: O.Option<string>;
};

export type ErroredItem = {
	file: TFile;
	status: FileStatus;
};

// type Base = {
// 	file: TFile;
// 	status: FileStatus;
// 	serverPath: string;
// 	md5: O.Option<string>;
// 	serverMd5: O.Option<string>;
// 	embeddedAssets: Set<string>;
// };

export type SRTEFileBuilder<T> = SRTE.StateReaderTaskEither<
	FileProcessingStateImpl,
	BaseContext,
	ErroredItem,
	T
>;

export type Post = Item & {
	type: FileType.POST;
	slug: string;
	conflictsWith: O.Option<string>;
};
export type Asset = Item & {
	type: FileType.ASSET;
};

export type BaseFile = Post | Asset;

export type BaseContext = {
	app: App;
	blog: Blog;
	pluginConfig: ReturnType<typeof buildPluginConfig>;
};

// Post paths are saved without the sync folder in server
// Assets paths are full paths, so we can't strip out the sync folder
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
		RTE.mapLeft(() => ({ file, status: FileStatus.READ_ERROR }))
	);

export const buildBaseFile = (
	file: TFile
): RTE.ReaderTaskEither<BaseContext, ErroredItem, Item> =>
	// ) =>
	pipe(
		R.asks((deps: BaseContext) => {
			return {
				file,
				status: FileStatus.PENDING,
				serverPath: getServerPath(file.path)(deps.blog.syncFolder),
				serverMd5: O.none,
			};
		}),
		RE.fromReader,
		RE.apS("embeddedAssets", pipe(file, getEmbeddedAssets, liftRightE)),
		RTE.fromReaderEither,
		RTE.apS("md5", getMd5RTE(file))
	);

const e = (file: TFile) => pipe(file, getMd52);
