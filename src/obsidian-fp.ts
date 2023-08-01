import { App, TFile } from "obsidian";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/function";
import { pluginConfig } from "./plugin-config";
import * as A from "fp-ts/Array";
import * as R from "fp-ts/Record";

type AppContext = {
	app: App;
};

export const getSlugFromFrontmatter = (file: TFile) =>
	pipe(
		RTE.ask<AppContext>(),
		RTE.chain(
			flow(
				({ app }) =>
					(app.metadataCache.getFileCache(file)?.frontmatter?.[
						pluginConfig.slugKey
					] ?? "") as string,
				RTE.of
			)
		)
	);

export const getDefaultSlugFromFile = (file: TFile) =>
	RTE.of(file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-"));

export const updateSlug = (file: TFile, slug: string) =>
	flow(
		RTE.ask<AppContext>(),
		TE.chain(({ app }) =>
			TE.tryCatch(
				() =>
					app.fileManager.processFrontMatter(file, (frontmatter) => {
						frontmatter[pluginConfig.slugKey] = slug;
					}),
				(e) => e
			)
		)
	);
/**
 * Gets slug for the TFile, and updates TFile's frontmatter if necessary
 */
export const getAndMaybeUpdateSlug = (file: TFile) =>
	pipe(
		[getSlugFromFrontmatter, getDefaultSlugFromFile],
		A.map((f) => f(file)),
		RTE.sequenceArray,
		RTE.tap(([fmSlug, defaultSlug]) => {
			if (fmSlug === "") {
				return updateSlug(file, defaultSlug);
			}
			return RTE.of(undefined);
		}),
		RTE.map(([fmSlug, defaultSlug]) => {
			return fmSlug === "" ? defaultSlug : fmSlug;
		})
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

export const getEmbeddedAssets = (file: TFile) =>
	flow(
		RTE.ask<AppContext>(),
		TE.map(
			flow(
				({ app }) => app.metadataCache.resolvedLinks[file.path],
				R.toArray,
				A.filter(([path, n]) => path.endsWith(".md5")),
				A.map(([path, n]) => path),
				(paths) => {
					return new Set<string>(paths);
				}
			)
		)
	);

export const getFiles_RTE = pipe(
	RTE.ask<AppContext>(),
	RTE.map(({ app }) => app.vault.getFiles())
);
