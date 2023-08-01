import { App, TFile } from "obsidian";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/function";
import { pluginConfig } from "./plugin-config";
import * as A from "fp-ts/Array";
import * as R from "fp-ts/Record";

type Context = {
	app: App;
};

export const getSlugFromFrontmatter = (file: TFile) =>
	pipe(
		RTE.ask<Context>(),
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

export const readPostRTE = (file: TFile) =>
	flow(
		RTE.ask<Context>(),
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
		RTE.ask<Context>(),
		TE.chain(
			flow(({ app }) =>
				TE.tryCatch(
					() => app.vault.readBinary(file),
					(e) => e
				)
			)
		)
	);

export const updateSlug = (file: TFile, slug: string) =>
	flow(
		RTE.ask<Context>(),
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

export const getEmbeddedAssets = (file: TFile) =>
	flow(
		RTE.ask<Context>(),
		TE.map(
			flow(
				({ app }) => app.metadataCache.resolvedLinks[file.path],
				R.toArray,
				A.filter(([path, n]) => path.endsWith(".md5")),
				A.map(([path, n]) => path),
				(paths) => {
					const embeddedAssets = new Set<string>(paths);
					return { embeddedAssets } as Record<string, any>;
				}
			)
		)
	);
