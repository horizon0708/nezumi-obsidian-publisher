import { App, TFile, Plugin, Modal } from "obsidian";
import { buildPluginConfig } from "src/shared/plugin-config";
import * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import { SavedBlog } from "src/shared/plugin-data";
import { FileError } from "src/shared/errors";
import BlogSync from "main";
import { PluginConfigT } from "./plugin-data/plugin-config";

export type AppContext = {
	app: App;
};
export type BlogContext = {
	blog: SavedBlog;
};
export type ModalContext = {
	modal: Modal;
};
export type DivContext = {
	div: HTMLDivElement;
};
export type PluginConfigContext = {
	pluginConfig: PluginConfigT;
};
export type PluginContextC = {
	plugin: BlogSync;
};

export type TuhuaContext = AppContext & PluginContextC & PluginConfigContext;
export type TuhuaCommandContext = AppContext & PluginContextC;
export type TuhuaBlogContext = TuhuaContext & BlogContext;

export enum FileStatus {
	NOOP = "NOOP",
	PENDING = "PENDING",
	SLUG_UPDATE_ERROR = "SKIP/SLUG_UPDATE_ERROR",
	SLUG_COLLISION = "SKIP/SLUG_COLLISION",
	MD5_COLLISION = "SKIP/MD5_COLLISION",
	READ_ERROR = "SKIP/READ_ERROR",
	UPLOAD_SUCCESS = "UPLOAD/SUCCESS",
	UPLOAD_ERROR = "UPLOAD/FAILURE",
	UPLOAD_CANCELLED = "UPLOAD/CANCELLED",
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
	sessionId: string;
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
