import { pipe } from "fp-ts/lib/function";
import { TFile } from "obsidian";
import * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as A from "fp-ts/Array";
import * as R from "fp-ts/Reader";
import * as r from "fp-ts/Record";
import {
	BaseContext,
	BaseItem,
	FileStatus,
	FileType,
	Item,
	RTEBuilder,
} from "../types";
import { FileError } from "./file-error";
import { separatedMonoid } from "./separated-monoid";
import { concatAll } from "fp-ts/lib/Monoid";
import { getFileMd5, getResolvedLinks } from "src/io/obsidian-fp";
import { getSlug } from "./get-slug";
import { getType } from "src/utils";

const eitherMonoid = separatedMonoid<FileError, Item>();

export const buildItems = (files: TFile[]) =>
	pipe(
		files,
		A.map(buildItem),
		RT.sequenceArray,
		RT.map((e) => pipe(eitherMonoid, concatAll)(e))
	);

const buildItem = (file: TFile) =>
	pipe(
		RTE.Do,
		RTE.let("file", () => file),
		RTE.let("status", () => FileStatus.PENDING),
		RTE.let("message", () => O.none),
		RTE.let("serverMd5", () => O.none),
		RTE.let("type", () => getType(file.path)),
		RTE.bind("md5", ({ type }) => getFileMd5(file, type)),
		RTE.apSW("serverPath", pipe(getServerPath(file.path), RTE.fromReader)),
		RTE.apSW(
			"embeddedAssets",
			pipe(getEmbeddedAssets(file.path), RTE.fromReader)
		),
		RTE.chainW((item) => buildPostOrAsset(item)),
		RTE.foldW(
			(e) => pipe(eitherMonoid.fromLeft(e), RT.of),
			(a) => pipe(eitherMonoid.fromRight(a), RT.of)
		)
	);

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

const buildPostOrAsset = (baseItem: BaseItem): RTEBuilder<Item> => {
	if (baseItem.type === FileType.ASSET) {
		return RTE.of({
			...baseItem,
			type: baseItem.type,
		});
	}

	return pipe(
		getSlug(baseItem.file),
		RTE.chainW((slug) =>
			RTE.of({ ...baseItem, slug, type: FileType.POST as const })
		)
	);
};
