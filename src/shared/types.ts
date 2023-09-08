import { App, TFile, Modal } from "obsidian";
import { Log, SavedBlog } from "src/shared/plugin-data";
import BlogSync from "main";
import { PluginConfigT } from "./plugin-data/plugin-config";
import { O } from "./fp";

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
	INVALID = "invalid",
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
	sessionId: O.Option<string>;
	logs: Log[];
	slug: string;
	links: Record<string, string>;
};

export type Post = BaseItem & {
	type: FileType.POST;
};

export type Asset = BaseItem & {
	type: FileType.ASSET;
};

export type Item = Post | Asset;

export type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};
