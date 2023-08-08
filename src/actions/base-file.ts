import { App, TFile } from "obsidian";
import * as O from "fp-ts/Option";
import * as R from "fp-ts/Reader";
import * as r from "fp-ts/Record";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { Blog } from "src/network";
import { buildPluginConfig } from "src/plugin-config";

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
export type Base = {
	file: TFile;
	status: FileStatus;
	serverPath: string;
	slug: O.Option<string>;
	conflictsWith: O.Option<string>;
	md5: O.Option<string>;
	serverMd5: O.Option<string>;
	embeddedAssets: Set<string>;
};

// type Base = {
// 	file: TFile;
// 	status: FileStatus;
// 	serverPath: string;
// 	md5: O.Option<string>;
// 	serverMd5: O.Option<string>;
// 	embeddedAssets: Set<string>;
// };

export type Post = Base & {
	type: FileType.POST;
};
export type Asset = Base & {
	type: FileType.ASSET;
};

export type BaseFile = Post | Asset;

export type BaseContext = {
	app: App;
	blog: Blog;
	pluginConfig: ReturnType<typeof buildPluginConfig>;
};

export type ProcessError = [FileStatus, O.Option<string>];

export const updateBaseFileFromError =
	(base: BaseFile) =>
	([status, conflictsWith]: ProcessError): BaseFile => {
		return {
			...base,
			status,
			conflictsWith,
		};
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

export const buildBaseFile = (file: TFile): R.Reader<BaseContext, BaseFile> =>
	pipe(
		R.asks((deps: BaseContext) => {
			return {
				file,
				type: file.path.endsWith(".md")
					? FileType.POST
					: FileType.ASSET,
				status: FileStatus.PENDING,
				serverPath: getServerPath(file.path)(deps.blog.syncFolder),
				slug: O.none,
				conflictsWith: O.none,
				md5: O.none,
				serverMd5: O.none,
			};
		}),
		R.apS("embeddedAssets", getEmbeddedAssets(file))
	);
