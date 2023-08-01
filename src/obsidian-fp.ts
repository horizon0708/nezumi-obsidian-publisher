import { App, TFile } from "obsidian";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/function";
import { pluginConfig } from "./plugin-config";

type Deps = {
	app: App;
	file: TFile;
};

export const getSlugFromFrontmatter = pipe(
	RTE.ask<Deps>(),
	RTE.chain(
		flow(
			({ file, app }) =>
				(app.metadataCache.getFileCache(file)?.frontmatter?.[
					pluginConfig.slugKey
				] ?? "") as string,
			RTE.of
		)
	)
);

export const getDefaultSlugFromFile = pipe(
	RTE.ask<Deps>(),
	RTE.chain(
		flow(
			({ file }) =>
				file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-"),
			RTE.of
		)
	)
);

export const readPostRTE = flow(
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

export const readAsset = flow(
	RTE.ask<Deps>(),
	TE.chain(
		flow(({ file, app }) =>
			TE.tryCatch(
				() => app.vault.readBinary(file),
				(e) => e
			)
		)
	)
);

export const updateSlug = (slug: string) =>
	flow(
		RTE.ask<Deps>(),
		TE.chain(({ app, file }) =>
			TE.tryCatch(
				() =>
					app.fileManager.processFrontMatter(file, (frontmatter) => {
						frontmatter[pluginConfig.slugKey] = slug;
					}),
				(e) => e
			)
		)
	);
