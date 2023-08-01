import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/function";
import * as S from "fp-ts/Semigroup";
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
import * as struct from "fp-ts/struct";

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

const getPostContentAndMD5 = (file: TFile) =>
	pipe(
		readPostRTE(file),
		RTE.map((content) => {
			const md5 = SparkMD5.hash(content);
			return { content, md5 };
		})
	);

const addEmbeddedAssets = (file: TFile) =>
	pipe(
		getEmbeddedAssets(file),
		RTE.map((embeddedAssets) => ({
			embeddedAssets,
		}))
	);

/**
 * Gets slug for the TFile, and updates TFile's frontmatter if necessary
 */
const getAndMaybeUpdateSlug = (file: TFile) =>
	pipe(
		[getSlugFromFrontmatter, getDefaultSlugFromFile],
		A.map((f) => f(file)),
		RTE.sequenceArray,
		RTE.tap(maybeUpdatePostFrontmatter(file)),
		RTE.map(([fmSlug, defaultSlug]) => {
			const slug = fmSlug === "" ? defaultSlug : fmSlug;
			return { slug };
		})
	);

export const e = (file: TFile) =>
	pipe(
		[getAndMaybeUpdateSlug, getPostContentAndMD5, getEmbeddedAssets],
		A.map((f) => f(file)),
		RTE.sequenceArray
	);

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
					getPostContentAndMD5(file),
				],
				RTE.sequenceArray,
				// RTE.map(R.fromFoldableMap(last(), A.Foldable))
				RTE.map(A.reduce({}, (acc, curr) => ({ ...acc, ...curr })))
			)
		)
	);
