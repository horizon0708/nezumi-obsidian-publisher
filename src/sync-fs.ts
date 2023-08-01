import * as RTE from "fp-ts/ReaderTaskEither";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/function";
import * as S from "fp-ts/Semigroup";
import * as A from "fp-ts/Array";
import {
	getAndMaybeUpdateSlug,
	getEmbeddedAssets,
	readPostRTE,
} from "./obsidian-fp";
import SparkMD5 from "spark-md5";
import { App, TFile } from "obsidian";
import { Blog } from "./types";

type Input = {
	file: TFile;
	serverMd5?: string;
};

type Context = {
	app: App;
	blog: Blog;
};

type FileState = Record<string, any>;

type FileParamBuilder = (
	file: TFile
) => SRTE.StateReaderTaskEither<FileState, Context, unknown, string>;

const returnEmptyString = () => SRTE.of("");

// const checkPathStart: FileParamBuilder = (file) =>
// 	pipe(
// 		SRTE.ask<FileState, Context>(),
// 		SRTE.chain(({ blog }) => {
// 			if (file.path.startsWith(blog.syncFolder)) {
// 				return SRTE.left("File is not in sync folder");
// 			}
// 			return returnEmptyString();
// 		})
// 	);

const getContentAndMD5_SRTE: FileParamBuilder = (file) =>
	pipe(
		readPostRTE(file),
		SRTE.fromReaderTaskEither,
		SRTE.map((content) =>
			SRTE.modify((state: FileState) => ({
				...state,
				content,
				md5: SparkMD5.hash(content),
			}))
		),
		SRTE.chain(returnEmptyString)
	);

const getAndMaybeUpdateSlug_SRTE: FileParamBuilder = (file) =>
	pipe(
		getAndMaybeUpdateSlug(file),
		SRTE.fromReaderTaskEither,
		SRTE.chain((slug) =>
			SRTE.modify((state: FileState) => ({ ...state, slug }))
		),
		SRTE.chain(returnEmptyString)
	);

const getEmbeddedAssets_SRTE: FileParamBuilder = (file) =>
	pipe(
		getEmbeddedAssets(file),
		SRTE.fromReaderTaskEither,
		SRTE.chain((embeddedAssets) =>
			SRTE.modify((state: FileState) => ({ ...state, embeddedAssets }))
		),
		SRTE.chain(returnEmptyString)
	);

export const processPost = ({ file }: Input) =>
	pipe(
		[
			getAndMaybeUpdateSlug_SRTE,
			getContentAndMD5_SRTE,
			getEmbeddedAssets_SRTE,
		],
		A.map((f) => f(file)),
		SRTE.sequenceArray
	);
