import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/function";
import { pluginConfig } from "./plugin-config";
import { sequenceT } from "fp-ts/Apply";
import {
	getDefaultSlugFromFile,
	getSlugFromFrontmatter,
	readPostRTE,
	updateSlug,
} from "./obsidian-fp";
import SparkMD5 from "spark-md5";

const shouldUpdateFrontmatter = ([slugFromFrontmatter, defaultSlug]: [
	string,
	string
]) => {
	if (slugFromFrontmatter === "") {
		return RTE.of(defaultSlug);
	}
	return RTE.left("slug already exists");
};

const maybeUpdatePostFrontmatter = flow(
	shouldUpdateFrontmatter,
	RTE.chain(updateSlug),
	RTE.orElse(() => RTE.of(undefined))
);

const setSlug = ([getSlugFromFrontmatter, defaultSlug]: [string, string]) => {
	const slug =
		getSlugFromFrontmatter === "" ? defaultSlug : getSlugFromFrontmatter;
	return { slug };
};

/**
 *  Surely there is a shorthand/ eqv. function for pipe into mapping?
 */
const addPostContentTE = (record: Record<string, any>) =>
	pipe(
		readPostRTE,
		RTE.map((content) => ({ ...record, content }))
	);
// RTE.map((content) => ({
// 	...record,
// 	content,
// }))

const addContentMD5 = (record: Record<string, any>) => {
	const content = record["content"];
	if (typeof content === "undefined") {
		return record;
	}
	return {
		...record,
		md5: SparkMD5.hash(content),
	};
};

export const testMd5 = pipe(
	sequenceT(RTE.ApplySeq)(getSlugFromFrontmatter, getDefaultSlugFromFile),
	RTE.tap(maybeUpdatePostFrontmatter),
	RTE.map(setSlug),
	RTE.chain(addPostContentTE),
	RTE.map(addContentMD5)
);
