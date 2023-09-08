import { TFile } from "obsidian";
import SparkMD5 from "spark-md5";
import {
	BlogContext,
	FileStatus,
	FileType,
	Item,
	ItemType,
	PluginConfigContext,
} from "../../shared/types";
import { separatedMonoid } from "../../shared/separated-monoid";
import { cachedRead, getFM, readBinary } from "src/shared/obsidian-fp";
import { getType, liftRT } from "src/shared/utils";
import { A, RTE, O, R, r, pipe, RT, Monoid, RE } from "src/shared/fp";
import { getLinksToPaths } from "./build-items/get-link-to-paths";

export const buildItems = (files: TFile[]) =>
	pipe(
		files,
		A.map(buildItem),
		RT.sequenceArray,
		RT.map((e) => pipe(eitherMonoid, Monoid.concatAll)(e))
	);
export const buildItemsRTE = RTE.fromReaderTaskK(buildItems);

const buildItem = (file: TFile) =>
	pipe(
		{
			file,
			status: FileStatus.PENDING,
			message: O.none,
			type: getType(file) as ItemType,
			serverMd5: O.none,
			sessionId: O.none,
			logs: [],
		},
		R.of,
		R.apSW("serverPath", getServerPath(file)),
		R.apSW("slug", getSlug(file)),
		RE.fromReader,
		RE.apSW("links", getLinksToPaths(file)),
		RE.let("embeddedAssets", ({ links }) => getEmbeddedAssets(links)),
		RTE.fromReaderEither,
		RTE.bindW("md5", ({ type }) => getFileMd5(file, type)),
		RTE.tapIO((e) => () => console.log(e.links)),
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
	(file: TFile) =>
	({ blog }: BlogContext) => {
		if (getType(file) === FileType.ASSET) {
			return file.path;
		}
		return blog.syncFolder === "/"
			? file.path
			: file.path.slice(blog.syncFolder.length + 1);
	};

const getEmbeddedAssets = (links: Record<string, string>) =>
	pipe(
		links,
		(links) => Object.values(links),
		A.filter((path) => !path.endsWith(".md")),
		(paths) => new Set<string>(paths)
	);

const getSlug = (file: TFile) => {
	if (file.extension === "md") {
		return pipe(
			getFM(file),
			R.flatMap(maybeGetSlug),
			R.map(O.getOrElse(() => getDefaultSlug(file)))
		);
	}
	return R.of(getAssetSlug(file));
};

const getAssetSlug = (file: TFile) => {
	const [pathWithoutExt] = file.path.split(".");
	return encodeURIComponent(pathWithoutExt) + "." + file.extension;
};

const maybeGetSlug =
	(maybeFm: O.Option<Record<string, any>>) =>
	({ pluginConfig: { slugKey } }: PluginConfigContext) =>
		pipe(
			maybeFm,
			O.map((fm) => fm[slugKey] as string)
		);

const getDefaultSlug = (file: TFile) =>
	file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-");
