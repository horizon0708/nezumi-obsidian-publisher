import { App, TFile } from "obsidian";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/function";
import { pluginConfig } from "./plugin-config";
import * as A from "fp-ts/Array";
import * as R from "fp-ts/Record";

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

export const updateSlug = (slug: string) =>
	RTE.asksReaderTaskEither(({ file }: FileContext) =>
		pipe(
			TE.tryCatch(
				() =>
					// note: This can't throw
					app.fileManager.processFrontMatter(file, (frontmatter) => {
						frontmatter[pluginConfig.slugKey] = slug;
					}),
				() => file.path
			),
			RTE.fromTaskEither
		)
	);

export const readPost = ({ app, file }: FileContext) =>
	TE.tryCatch(
		() => app.vault.cachedRead(file),
		() => file.path
	);

export const readAsset = ({ app, file }: FileContext) =>
	TE.tryCatch(
		() => app.vault.readBinary(file),
		() => file.path
	);

export const getFile =
	(path: string) =>
	({ app }: AppContext): TE.TaskEither<string, TFile> => {
		const file = app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return TE.right(file);
		}
		return TE.left(path);
	};

export const getEmbeddedAssets = ({ app, file }: FileContext) =>
	pipe(
		app.metadataCache.resolvedLinks[file.path],
		R.toArray,
		A.filter(([path, n]) => !path.endsWith(".md")),
		A.map(([path, n]) => path),
		(paths) => new Set<string>(paths),
		TE.of
	);

export const getFiles_RTE = pipe(
	RTE.ask<AppContext>(),
	RTE.map(({ app }) => app.vault.getFiles())
);
