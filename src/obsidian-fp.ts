import { App, TFile, getBlobArrayBuffer, requestUrl } from "obsidian";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/function";
import { buildPluginConfig } from "./plugin-config";
import * as A from "fp-ts/Array";
import * as R from "fp-ts/Record";
import * as O from "fp-ts/Option";
import SparkMD5 from "spark-md5";

export type AppContext = {
	app: App;
};

type FileContext = {
	app: App;
	file: TFile;
	pluginConfig: ReturnType<typeof buildPluginConfig>;
};

export const getSlugFromFrontmatter = RTE.asks(
	({ app, file, pluginConfig }: FileContext) =>
		(app.metadataCache.getFileCache(file)?.frontmatter?.[
			pluginConfig.slugKey
		] ?? "") as string
);

export const getSlugFromFrontmatter2 = RTE.asks(
	({ app, file, pluginConfig }: FileContext) =>
		pipe(
			app.metadataCache.getFileCache(file)?.frontmatter?.[
				pluginConfig.slugKey
			],
			O.fromNullable<string>
		)
);

export const getDefaultSlugFromFile = RTE.asks(({ file }: FileContext) =>
	file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-")
);

export const getDefaultSlugFromFile2 = RTE.asks(({ file }: FileContext) =>
	file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-")
);

export const updateSlug = (slug: string) =>
	RTE.asksReaderTaskEither(({ file, pluginConfig }: FileContext) =>
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

export const getMd5 = ({ app, file }: FileContext) => {
	const path = file.path;
	if (path.endsWith(".md")) {
		return pipe(
			TE.tryCatch(
				() => app.vault.cachedRead(file),
				() => file
			),
			TE.map((content) => SparkMD5.hash(content))
		);
	}
	return pipe(
		TE.tryCatch(
			() => app.vault.readBinary(file),
			() => file
		),
		TE.map((content) => SparkMD5.ArrayBuffer.hash(content))
	);
};

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

export const getEmbeddedAssets2 = ({ app, file }: FileContext) =>
	pipe(
		app.metadataCache.resolvedLinks[file.path],
		R.toArray,
		A.filter(([path, n]) => !path.endsWith(".md")),
		A.map(([path, n]) => path),
		(paths) => new Set<string>(paths)
	);

export const getFiles_RTE = pipe(
	RTE.ask<AppContext>(),
	RTE.map(({ app }) => app.vault.getFiles())
);

export const fetchUrl = TE.tryCatchK(requestUrl, (e) => e);

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
