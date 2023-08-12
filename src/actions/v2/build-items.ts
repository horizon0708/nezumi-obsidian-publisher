import { pipe } from "fp-ts/lib/function";
import { TFile } from "obsidian";
import { buildBaseItem } from "./build-base-item";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as A from "fp-ts/Array";
import { Item } from "../types";
import { FileError } from "./file-error";
import { buildPostOrAsset } from "./build-post";
import { separatedMonoid } from "./srte-monoid";
import { concatAll } from "fp-ts/lib/Monoid";

const eitherMonoid = separatedMonoid<FileError, Item>();

const buildItem = (file: TFile) =>
	pipe(
		buildBaseItem(file),
		RTE.chainW((item) => buildPostOrAsset(item)),
		RTE.foldW(
			(e) => pipe(eitherMonoid.fromLeft(e), RT.of),
			(a) => pipe(eitherMonoid.fromRight(a), RT.of)
		)
	);

export const buildItems = (files: TFile[]) =>
	pipe(
		files,
		A.map(buildItem),
		RT.sequenceArray,
		RT.map((e) => pipe(eitherMonoid, concatAll)(e))
	);
