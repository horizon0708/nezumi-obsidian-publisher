import { MarkdownRenderer, Notice, TFile, requestUrl } from "obsidian";
import { AppContext, PluginContextC } from "src/shared/types";
import { FileError, NetworkError } from "./errors";
import { TE, O, RTE, R, pipe } from "./fp";

/*
 * This module is a **thin** wrapper for the Obsidian API
 *
 */

export const renderMarkdown =
	(markdown: string) =>
	({
		app,
		plugin,
		element,
	}: AppContext & PluginContextC & { element: HTMLElement }) =>
	() => {
		MarkdownRenderer.render(app, markdown, element, "", plugin);
	};

export const showNotice = (message: string) => {
	new Notice(message);
};

export const saveData =
	<T>(data: T) =>
	({ plugin }: PluginContextC) =>
		TE.tryCatch(
			() => plugin.saveData(data),
			(e) => {
				return e;
			}
		);

export const loadData = ({ plugin }: PluginContextC) =>
	TE.tryCatch(
		() => plugin.loadData(),
		(e) => {
			return e;
		}
	);

export const getFM = (file: TFile) =>
	R.asks(({ app }: AppContext) =>
		pipe(app.metadataCache.getFileCache(file)?.frontmatter, O.fromNullable)
	);

export const buildFmUpdater = (processFn: (fm: any) => void) => (file: TFile) =>
	RTE.asksReaderTaskEither(({ app }: AppContext) =>
		pipe(
			TE.tryCatch(
				() => app.fileManager.processFrontMatter(file, processFn),
				() => new FileError("Failed to update FM", file.path)
			),
			RTE.fromTaskEither
		)
	);

export const cachedRead =
	(file: TFile) =>
	({ app }: AppContext) =>
		TE.tryCatch(
			() => app.vault.cachedRead(file),
			() => new FileError("Failed to read file", file.path)
		);

export const readBinary =
	(file: TFile) =>
	({ app }: AppContext) =>
		TE.tryCatch(
			() => app.vault.readBinary(file),
			() => new FileError("Failed to read file", file.path)
		);

export const getResolvedLinks =
	(path: string) =>
	({ app }: AppContext) =>
		app.metadataCache.resolvedLinks[path] ?? [];

export const getFile =
	(path: string) =>
	({ app }: AppContext) => {
		const file = app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return O.some(file);
		}
		return O.none;
	};

export const getFiles = pipe(
	R.ask<AppContext>(),
	R.map(({ app }) => app.vault.getFiles())
);

export const fetchUrl = TE.tryCatchK(
	requestUrl,
	(e: any): NetworkError | Error => {
		if (e.status) {
			return new NetworkError(e.status, e.message);
		}
		// if there is no status, then its not a network error.
		return new Error("Unhandled error");
	}
);
