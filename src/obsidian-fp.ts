import { App, TFile } from "obsidian";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as s from "fp-ts/struct";
import { flow, pipe } from "fp-ts/function";
import { pluginConfig } from "./plugin-config";
import * as A from "fp-ts/Array";
import * as R from "fp-ts/Record";
import * as RIO from "fp-ts/ReaderIO";

export type AppContext = {
	app: App;
};

type FileContext = {
	app: App;
	file: TFile;
};

export const getSlugFromFrontmatter = RTE.asks(
	({ app, file }: FileContext) =>
		(app.metadataCache.getFileCache(file)?.frontmatter?.[
			pluginConfig.slugKey
		] ?? "") as string
);

export const getDefaultSlugFromFile = RTE.asks(
	({ file }: FileContext) =>
		file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-") as string
);

// can't I use this to widen the types?
export const maybeUpdateSlugInFrontmatter = (
	fmSlug: string,
	defaultSlug: string
) => RTE.asksReaderTaskEitherW((r: FileContext) => (r) => TE.of(""));

export const updateSlug2 = (slug: string) =>
	RTE.asksReaderTaskEither(({ file }: FileContext) =>
		pipe(
			TE.tryCatch(
				() =>
					// note: This can't throw
					app.fileManager.processFrontMatter(file, (frontmatter) => {
						frontmatter[pluginConfig.slugKey] = slug;
					}),
				(e) => e
			),
			RTE.fromTaskEither
		)
	);

export const updateSlug = (file: TFile, slug: string) =>
	flow(
		RTE.ask<AppContext>(),
		TE.chain(({ app }) =>
			TE.tryCatch(
				() =>
					// note: This can't throw
					app.fileManager.processFrontMatter(file, (frontmatter) => {
						frontmatter[pluginConfig.slugKey] = slug;
					}),
				(e) => e
			)
		),
		TE.fold(TE.of, TE.of)
	);

/**
 * Gets slug for the TFile, and updates TFile's frontmatter if necessary
 */
export const getSlugAndMaybeUpdateFrontmatter = (file: TFile) =>
	pipe(
		RTE.Do,
		RTE.apS("fmSlug", getSlugFromFrontmatter),
		RTE.apS("defaultSlug", getDefaultSlugFromFile),
		RTE.tap(({ fmSlug, defaultSlug }) => {
			if (fmSlug === "") {
				return updateSlug(file, defaultSlug);
			}
		}),
		RTE.map(({ fmSlug, defaultSlug }) =>
			fmSlug === "" ? defaultSlug : fmSlug
		)
	);

export const readPost = ({ app, file }: FileContext) =>
	TE.tryCatch(
		() => app.vault.cachedRead(file),
		() => "error"
	);

export const readPostRTE = (file: TFile) =>
	flow(
		RTE.ask<AppContext>(),
		TE.chain(
			flow(({ app }) =>
				TE.tryCatch(
					() => app.vault.cachedRead(file),
					(e) => e
				)
			)
		)
	);

export const readAsset = (file: TFile) =>
	flow(
		RTE.ask<AppContext>(),
		TE.chain(
			flow(({ app }) =>
				TE.tryCatch(
					() => app.vault.readBinary(file),
					(e) => e
				)
			)
		)
	);

export const getEmbeddedAssets2 = ({ app, file }: FileContext) =>
	pipe(
		app.metadataCache.resolvedLinks[file.path],
		R.toArray,
		A.filter(([path, n]) => path.endsWith(".md")),
		A.map(([path, n]) => path),
		(paths) => new Set<string>(paths),
		TE.of
	);

export const getEmbeddedAssets = <R extends AppContext>(file: TFile) =>
	flow(
		RTE.ask<R>(),
		TE.map(
			flow(
				({ app }) => app.metadataCache.resolvedLinks[file.path],
				R.toArray,
				A.filter(([path, n]) => path.endsWith(".md")),
				A.map(([path, n]) => path),
				(paths) => new Set<string>(paths)
			)
		)
	);

export const getFiles_RTE = pipe(
	RTE.ask<AppContext>(),
	RTE.map(({ app }) => app.vault.getFiles())
);
