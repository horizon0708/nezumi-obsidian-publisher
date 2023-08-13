import { pipe } from "fp-ts/function";
import { Notice, TFile, getBlobArrayBuffer, requestUrl } from "obsidian";
import * as O from "fp-ts/Option";
import * as R from "fp-ts/Reader";
import { BaseContext } from "src/actions/types";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { FileError } from "src/shared/file-error";

/*
 * This module is a **thin** wrapper for the Obsidian API
 *
 */

export const showNotice = (message: string) => {
	new Notice(message);
};

export const getFM = (file: TFile) =>
	R.asks(({ app }: BaseContext) =>
		pipe(app.metadataCache.getFileCache(file)?.frontmatter, O.fromNullable)
	);

export const buildFmUpdater = (processFn: (fm: any) => void) => (file: TFile) =>
	RTE.asksReaderTaskEither(({ app }: BaseContext) =>
		pipe(
			TE.tryCatch(
				() => app.fileManager.processFrontMatter(file, processFn),
				() => new FileError("Failed to update FM", file)
			),
			RTE.fromTaskEither
		)
	);

export const cachedRead =
	(file: TFile) =>
	({ app }: BaseContext) =>
		TE.tryCatch(
			() => app.vault.cachedRead(file),
			() => new FileError("Failed to read file", file)
		);

export const readBinary =
	(file: TFile) =>
	({ app }: BaseContext) =>
		TE.tryCatch(
			() => app.vault.readBinary(file),
			() => new FileError("Failed to read file", file)
		);

export const getResolvedLinks =
	(path: string) =>
	({ app }: BaseContext) =>
		app.metadataCache.resolvedLinks[path] ?? [];

export const getFile =
	(path: string) =>
	({ app }: BaseContext) => {
		const file = app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return O.some(file);
		}
		return O.none;
	};

export const getFiles = pipe(
	R.ask<BaseContext>(),
	R.map(({ app }) => app.vault.getFiles())
);

export const fetchUrl = TE.tryCatchK(requestUrl, (e) => e);

// IMPROVEMENT: This should be in a separate module
export async function encodeFormDataBody(
	payload: ArrayBuffer,
	randomBoundryString: string,
	mimeType: string = "application/octet-stream"
) {
	// Construct the form data payload as a string
	const pre_string = `------${randomBoundryString}\r\nContent-Disposition: form-data; name="file"; filename="blob"\r\nContent-Type: "${mimeType}"\r\n\r\n`;
	const post_string = `\r\n------${randomBoundryString}--`;

	// Convert the form data payload to a blob by concatenating the pre_string, the file data, and the post_string, and then return the blob as an array buffer
	const pre_string_encoded = new TextEncoder().encode(pre_string);
	const data = new Blob([payload]);
	const post_string_encoded = new TextEncoder().encode(post_string);
	return await new Blob([
		pre_string_encoded,
		await getBlobArrayBuffer(data),
		post_string_encoded,
	]).arrayBuffer();
}

export const buildFormDataBodyTE = TE.tryCatchK(encodeFormDataBody, (e) => e);
