import { App, TFile } from "obsidian";
import * as S from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { flow } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import * as RIO from "fp-ts/ReaderIO";
import * as IO from "fp-ts/IO";
import { sequence, traverse } from "fp-ts/Traversable";
import { Blog } from "./types";
import { pluginConfig } from "./plugin-config";
import { sequenceT } from "fp-ts/Apply";

type Deps = {
	app: App;
	file: TFile;
	blog: Blog;
	serverMD5?: string;
};

type State = {
	count: number;
};

const a = RTE.of<Deps, never, string>("hello");

type FileParams = {
	slug: string;
	shouldAppendSlug: boolean;
};

type FileParamBuilder = (
	params: Partial<FileParams>
) => RTE.ReaderTaskEither<Deps, unknown, Partial<FileParams>>;

const getSlugFromFrontmatter = flow(
	RTE.ask<Deps>(),
	TE.chain(
		flow(
			({ file, app }) =>
				app.metadataCache.getFileCache(file)?.frontmatter?.[
					pluginConfig.slugKey
				] ?? "",
			TE.of
		)
	)
);

const getDefaultSlugFromFile = flow(
	RTE.ask<Deps>(),
	TE.chain(
		flow(
			({ file }) =>
				file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-"),
			TE.of
		)
	)
);

const readPost = flow(
	RTE.ask<Deps>(),
	TE.chain(
		flow(({ file, app }) =>
			TE.tryCatch(
				() => app.vault.cachedRead(file),
				(e) => e
			)
		)
	)
);

flow(
	sequenceT(RTE.ApplySeq)(getSlugFromFrontmatter, getDefaultSlugFromFile),
	TE.map(([frontmatterSlug, defaultSlug]) => frontmatterSlug + defaultSlug)
);

// Should use array and get the dependency
const putS = (params: FileParams) =>
	flow(
		RTE.ask<Deps>(),
		TE.chain(flow(getSlugFromFrontmatter))
		// RTE.chainW<unknown, unknown, Deps, string>(deps => getSlugFromFrontmatter)
	);

const putSlug: FileParamBuilder = (params) => {
	return RTE.asks(({ file, app }) => {
		const frontMatterSlug =
			app.metadataCache.getFileCache(file)?.frontmatter?.[
				pluginConfig.slugKey
			];
		return {
			...params,
			slug:
				frontMatterSlug ??
				file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-"),
			shouldAppendSlug: frontMatterSlug === undefined,
		};
	});
};

const maybeAppendSlugToFrontmatter: FileParamBuilder = (params) =>
	flow(
		RTE.ask<Deps>(),
		TE.chain((deps) => {
			return TE.fromPredicate<string, Deps>(
				() => params.shouldAppendSlug,
				() => "slug has not changed"
			)(deps);
		}),
		TE.chain(({ file, app }) =>
			TE.tryCatch(
				() =>
					app.fileManager.processFrontMatter(file, (frontmatter) => {
						frontmatter[pluginConfig.slugKey] = params.slug;
					}),
				(e) => e
			)
		),
		TE.fold(
			() => TE.of(params),
			() => TE.of(params)
		)
	);

const rr = flow(putSlug, RTE.chain(maybeAppendSlugToFrontmatter));

RTE.traverseArray;

// const addSlugToFrontmatter: FileParamBuilder = (params) =>
// 	RTE.asks(({ file }) => {
// 		const { slug, shouldAppendSlug } = params;
// 		if (!shouldAppendSlug) {
// 			return params;
// 		}

// 		return RTE.fromTaskEither(
// 			TE.tryCatch(
// 				() => app.fileManager.processFrontMatter(file, (frontmatter) => {
// 					frontmatter[pluginConfig.slugKey] = slug;
// 				}),
// 				(e) => e
// 			)
// 		);
// 	});

const e = flow(
	a,
	RTE.asks((r) => TE.of("as"))
);
