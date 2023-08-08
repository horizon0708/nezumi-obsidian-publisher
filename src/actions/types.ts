import { App, TFile } from "obsidian";
import { Blog } from "src/network";
import { buildPluginConfig } from "src/plugin-config";
import * as O from "fp-ts/Option";
import * as R from "fp-ts/Reader";
import * as RE from "fp-ts/ReaderEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import { FileProcessingStateImpl } from "src/file-processing-state";

export type BaseContext = {
	app: App;
	blog: Blog;
	pluginConfig: ReturnType<typeof buildPluginConfig>;
};

export enum FileStatus {
	NOOP = "NOOP",
	PENDING = "PENDING",
	SLUG_UPDATE_ERROR = "SKIP/SLUG_UPDATE_ERROR",
	SLUG_COLLISION = "SKIP/SLUG_COLLISION",
	MD5_COLLISION = "SKIP/MD5_COLLISION",
	READ_ERROR = "SKIP/READ_ERROR",
	UPLOAD_PENDING = "UPLOAD/PENDING",
	UPLOAD_SUCCESS = "UPLOAD/SUCCESS",
	UPLOAD_FAILURE = "UPLOAD/FAILURE",
}

export enum FileType {
	POST = "post",
	ASSET = "asset",
}

type ErroredItem = {
	file: TFile;
	status: FileStatus;
	message: O.None;
};

type BaseItem = {
	file: TFile;
	status: FileStatus;
	serverPath: string;
	md5: string;
	embeddedAssets: Set<string>;
	serverMd5: O.Option<string>;
};

type Post = BaseItem & {
	type: FileType.POST;
	slug: string;
};

type Asset = BaseItem & {
	type: FileType.ASSET;
};

type Item = Post | Asset;

declare const test: Item;

type SRTEBuilder<E, A> = SRTE.StateReaderTaskEither<
	FileProcessingStateImpl,
	BaseContext,
	E,
	A
>;

type ItemBuilder = (file: TFile) => SRTEBuilder<ErroredItem, Item>;

type ItemsBuilder = (files: TFile[]) => SRTEBuilder<ErroredItem[], Item[]>;

type ItemsFetcher = (item: Item[]) => SRTEBuilder<ErroredItem[], Item[]>;
