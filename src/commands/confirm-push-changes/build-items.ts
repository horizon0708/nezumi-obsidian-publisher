import { pipe } from "fp-ts/lib/function";
import { TFile } from "obsidian";
import * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as A from "fp-ts/Array";
import * as R from "fp-ts/Reader";
import * as r from "fp-ts/Record";
import {
	BlogContext,
	FileStatus,
	FileType,
	Item,
	ItemType,
	PluginConfigContext,
} from "../../shared/types";
import { separatedMonoid } from "../../shared/separated-monoid";
import { concatAll } from "fp-ts/lib/Monoid";
import {
	cachedRead,
	getFM,
	getResolvedLinks,
	readBinary,
} from "src/shared/obsidian-fp";
import { getType, liftRT } from "src/shared/utils";
import SparkMD5 from "spark-md5";

export const buildItems = (files: TFile[]) =>
	pipe(
		files,
		A.map(buildItem),
		RT.sequenceArray,
		RT.map((e) => pipe(eitherMonoid, concatAll)(e))
	);
export const buildItemsRTE = RTE.fromReaderTaskK(buildItems);

const buildItem = (file: TFile) =>
	pipe(
		{
			file,
			status: FileStatus.PENDING,
			message: O.none,
			type: getType(file.path) as ItemType,
			serverMd5: O.none,
			sessionId: O.none,
			logs: [],
		},
		R.of,
		R.apSW("serverPath", getServerPath(file.path)),
		R.apSW("embeddedAssets", getEmbeddedAssets(file.path)),
		R.apSW("slug", getSlug(file)),
		RTE.rightReader,
		RTE.bindW("md5", ({ type }) => getFileMd5(file, type)),
		RTE.foldW(liftRT(eitherMonoid.fromLeft), liftRT(eitherMonoid.fromRight))
	);

const eitherMonoid = separatedMonoid<Error, Item>();

const getFileMd5 = (file: TFile, type: ItemType) => {
	if (type === FileType.POST) {
		return pipe(cachedRead(file), RTE.map(SparkMD5.hash));
	}
	return pipe(readBinary(file), RTE.map(SparkMD5.ArrayBuffer.hash));
};

const getServerPath =
	(path: string) =>
	({ blog }: BlogContext) => {
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

const getSlug = (file: TFile) =>
	pipe(
		getFM(file),
		R.flatMap(maybeGetSlug),
		R.map(O.getOrElse(() => getDefaultSlug(file)))
	);

const maybeGetSlug =
	(maybeFm: O.Option<Record<string, any>>) =>
	({ pluginConfig: { slugKey } }: PluginConfigContext) =>
		pipe(
			maybeFm,
			O.map((fm) => fm[slugKey] as string)
		);

const getDefaultSlug = (file: TFile) =>
	file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-");
