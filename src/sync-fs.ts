import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/function";
import * as A from "fp-ts/Array";
import {
	getDefaultSlugFromFile,
	getEmbeddedAssets,
	getSlugFromFrontmatter,
	readPostRTE,
	updateSlug,
} from "./obsidian-fp";
import SparkMD5 from "spark-md5";
import { TFile } from "obsidian";
import * as R from "fp-ts/Record";

export type FPost = {
	slug: string;
};

const shouldUpdateFrontmatter = ([slugFromFrontmatter, defaultSlug]: [
	string,
	string
]) => {
	if (slugFromFrontmatter === "") {
		return RTE.of(defaultSlug);
	}
	return RTE.left("slug already exists");
};

const maybeUpdatePostFrontmatter = (file: TFile) =>
	flow(
		shouldUpdateFrontmatter,
		RTE.chain((slug) => updateSlug(file, slug)),
		RTE.orElse(() => RTE.of(undefined))
	);

const setSlug = ([getSlugFromFrontmatter, defaultSlug]: [
	string,
	string
]): Record<string, any> => {
	const slug =
		getSlugFromFrontmatter === "" ? defaultSlug : getSlugFromFrontmatter;
	return { slug };
};

/**
 *  Surely there is a shorthand/ eqv. function for pipe into mapping?
 */
const addPostContentTE = (file: TFile) => (record: Record<string, any>) =>
	pipe(
		readPostRTE(file),
		RTE.map((content) => ({ ...record, content }))
	);
// RTE.map((content) => ({
// 	...record,
// 	content,
// }))

const setPostContentAndMD5 = (file: TFile) =>
	pipe(
		readPostRTE(file),
		RTE.map(
			(content) =>
				({ content, md5: SparkMD5.hash(content) } as Record<
					string,
					string
				>)
		)
	);

const addContentMD5 = (record: Record<string, any>) => {
	const content = record["content"];
	if (typeof content === "undefined") {
		return record;
	}
	return {
		...record,
		// md5: SparkMD5.hash(content),
	};
};

const addEmbeddedAssets = (file: TFile) =>
	pipe(
		getEmbeddedAssets(file),
		RTE.map((embeddedAssets) => ({
			embeddedAssets,
		}))
	);

RTE.sequenceArray([getEmbeddedAssets(new TFile())]);

export const testMd5 = (file: TFile) =>
	pipe(
		[getSlugFromFrontmatter, getDefaultSlugFromFile],
		A.map((f) => f(file)),
		RTE.sequenceArray,
		RTE.tap(maybeUpdatePostFrontmatter(file)),
		RTE.chain(
			flow(
				(slugs) => [
					RTE.of(setSlug(slugs)),
					addEmbeddedAssets(file),
					setPostContentAndMD5(file),
				],
				RTE.sequenceArray
			)
		),
		RTE.map((e) => R.fromFoldableMap(e, A.Foldable))
		// RTE.chain(RTE.sequenceArray)
		// RTE.map(setSlug),
		// RTE.chain(addPostContentTE(file)),
		// RTE.map(addContentMD5)
	);
