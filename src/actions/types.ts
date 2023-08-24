import { App, TFile, Plugin } from "obsidian";
import { buildPluginConfig } from "src/plugin-config";
import * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import { FileError } from "../shared/file-error";
import { SavedBlog } from "src/io/plugin-data";

export type AppContext = {
	app: App;
	pluginConfig: ReturnType<typeof buildPluginConfig>;
};

export type BaseContext = {
	app: App;
	blog: SavedBlog;
	pluginConfig: ReturnType<typeof buildPluginConfig>;
};

export type PluginContext = {
	app: App;
	plugin: Plugin;
	// pluginConfig: ReturnType<typeof buildPluginConfig>;
};

export enum FileStatus {
	NOOP = "NOOP",
	PENDING = "PENDING",
	SLUG_UPDATE_ERROR = "SKIP/SLUG_UPDATE_ERROR",
	SLUG_COLLISION = "SKIP/SLUG_COLLISION",
	MD5_COLLISION = "SKIP/MD5_COLLISION",
	READ_ERROR = "SKIP/READ_ERROR",
	UPLOAD_SUCCESS = "UPLOAD/SUCCESS",
	UPLOAD_ERROR = "UPLOAD/FAILURE",
}

export type ItemType = FileType.POST | FileType.ASSET;

export enum FileType {
	POST = "post",
	ASSET = "asset",
}

export type ErroredItem = {
	file: TFile;
	status: FileStatus;
	message: O.Option<string>;
};

export type BaseItem = ErroredItem & {
	serverPath: string;
	md5: string;
	embeddedAssets: Set<string>;
	serverMd5: O.Option<string>;
	type: FileType;
};

export type Post = BaseItem & {
	type: FileType.POST;
	slug: string;
};

export type Asset = BaseItem & {
	type: FileType.ASSET;
};

export type Item = Post | Asset;

export type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

export type RTEBuilder<A> = RTE.ReaderTaskEither<BaseContext, FileError, A>;
