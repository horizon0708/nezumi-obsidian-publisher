import { pipe } from "fp-ts/lib/function";
import { TFile } from "obsidian";
import * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as A from "fp-ts/Array";
import * as R from "fp-ts/Reader";
import * as r from "fp-ts/Record";
import {
	Asset,
	BaseContext,
	BaseItem,
	FileStatus,
	FileType,
	Item,
	ItemType,
	Post,
	RTEBuilder,
} from "../types";
import { separatedMonoid } from "../../shared/separated-monoid";
import { concatAll } from "fp-ts/lib/Monoid";
import { cachedRead, getResolvedLinks, readBinary } from "src/io/obsidian-fp";
import { getSlug } from "./get-slug";
import { getType, liftRT } from "src/utils";
import SparkMD5 from "spark-md5";
import { getCurrentUploadSessionIdRTE } from "src/shared/plugin-data/upload-session";

const eitherMonoid = separatedMonoid<Error, Item>();

export const buildItems = (files: TFile[]) =>
	pipe(
		files,
		A.map(buildItem),
		RT.sequenceArray,
		RT.map((e) => pipe(eitherMonoid, concatAll)(e))
	);
export const buildItemsRTE = RTE.chainReaderTaskKW(buildItems);

export const setItemStatus =
	(status: FileStatus) =>
	(item: Item): Item => ({
		...item,
		status,
	});

const buildItem = (file: TFile) =>
	pipe(
		RTE.Do,
		RTE.let("file", () => file),
		RTE.let("status", () => FileStatus.PENDING),
		RTE.let("message", () => O.none),
		RTE.let("serverMd5", () => O.none),
		RTE.let("type", () => getType(file.path)),
		RTE.bind("md5", ({ type }) => getFileMd5(file, type)),
		RTE.apSW("serverPath", getServerPathRTE(file.path)),
		RTE.apSW("embeddedAssets", getEmbeededAssetsRTE(file.path)),
		RTE.apSW("sessionId", getCurrentUploadSessionIdRTE),
		RTE.chainW(buildPostOrAsset),
		RTE.foldW(liftRT(eitherMonoid.fromLeft), liftRT(eitherMonoid.fromRight))
	);

const getFileMd5 = (file: TFile, type: ItemType) => {
	if (type === FileType.POST) {
		return pipe(cachedRead(file), RTE.map(SparkMD5.hash));
	}
	return pipe(readBinary(file), RTE.map(SparkMD5.ArrayBuffer.hash));
};

const getServerPath =
	(path: string) =>
	({ blog }: BaseContext) => {
		if (getType(path) === FileType.ASSET) {
			return path;
		}
		return blog.syncFolder === "/"
			? path
			: path.slice(blog.syncFolder.length + 1);
	};
const getServerPathRTE = RTE.fromReaderK(getServerPath);

const getEmbeddedAssets = (path: string) =>
	pipe(
		getResolvedLinks(path),
		R.map((links) =>
			pipe(
				links,
				r.toArray,
				A.filter(([path, n]) => getType(path) === FileType.ASSET),
				A.map(([path, n]) => path),
				(paths) => new Set<string>(paths)
			)
		)
	);
const getEmbeededAssetsRTE = RTE.fromReaderK(getEmbeddedAssets);

const buildPostOrAsset = (baseItem: BaseItem): RTEBuilder<Post | Asset> => {
	if (baseItem.type === FileType.ASSET) {
		return RTE.of({
			...baseItem,
			type: baseItem.type,
		});
	}

	return pipe(
		getSlug(baseItem.file),
		RTE.map((slug) => ({ ...baseItem, slug, type: FileType.POST }))
	);
};
