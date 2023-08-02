import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/function";
import {
	getAndMaybeUpdateSlug,
	getEmbeddedAssets,
	readPostRTE,
} from "./obsidian-fp";
import SparkMD5 from "spark-md5";
import { App, TFile } from "obsidian";
import { Blog } from "./types";

type FileContext = {
	app: App;
	blog: Blog;
	file: TFile;
	serverMd5?: string;
};

type FileParamsBuilder2 = (
	params: Record<string, any>
) => RTE.ReaderTaskEither<FileContext, unknown, Record<string, any>>;

const getAndMaybeUpdateSlug_RTE: FileParamsBuilder2 = (params) =>
	pipe(
		RTE.ask<FileContext>(),
		RTE.chain(({ file }) => getAndMaybeUpdateSlug(file)),
		RTE.map((slug) => ({ ...params, slug }))
	);

const getContentAndMD5_RTE: FileParamsBuilder2 = (params) =>
	pipe(
		RTE.ask<FileContext>(),
		RTE.chain(({ file, serverMd5 }) =>
			pipe(
				readPostRTE(file),
				RTE.map((content) => ({
					...params,
					content,
					md5: SparkMD5.hash(content),
				})),
				RTE.chain(({ md5 }) =>
					serverMd5 && serverMd5 === md5
						? RTE.left({ ...params, status: "SKIP/MD5_MATCH" })
						: RTE.of(params)
				)
			)
		)
	);

const getEmbeddedAssets_RTE: FileParamsBuilder2 = (params) =>
	pipe(
		RTE.ask<FileContext>(),
		RTE.chain(({ file }) => getEmbeddedAssets(file)),
		RTE.map((embeddedAssets) => ({
			...params,
			embeddedAssets,
		}))
	);

export const processPost = pipe(
	getAndMaybeUpdateSlug_RTE({}),
	RTE.chain(getContentAndMD5_RTE),
	RTE.chain(getEmbeddedAssets_RTE),
	// TODO: io-ts to cast runtime data into type?
	// we use Either to shortcut processing when an error occurs
	// but we don't want to short circuit the whole process
	// so we convert left into right
	RTE.fold(
		(e) => RTE.right(e),
		(a) => RTE.right(a)
	)
);
