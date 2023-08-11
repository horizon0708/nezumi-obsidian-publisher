import { flip, pipe } from "fp-ts/function";
import { App, TFile } from "obsidian";
import * as O from "fp-ts/Option";
import * as R from "fp-ts/Reader";
import { BaseContext, FileStatus, FileType } from "src/actions/types";
import { getFileMd5, getResolvedLinks } from "src/io/obsidian-fp2";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import * as r from "fp-ts/Record";

export const getType = (path: string) =>
	path.endsWith(".md") ? FileType.POST : FileType.ASSET;

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

export const buildBaseItem = (file: TFile) =>
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
		)
	);
