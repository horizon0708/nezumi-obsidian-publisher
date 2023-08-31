import { flow, pipe } from "fp-ts/function";
import { concatAll } from "fp-ts/lib/Monoid";
import { successResultM, errorResultM, resultM } from "./utils";
import { fetchUrl } from "./obsidian-fp";
import { AppContext, BlogContext, PluginConfigContext } from "src/shared/types";
import { DecodeError } from "src/shared/errors";
import { getBlobArrayBuffer } from "obsidian";
import { FORM_DATA_DELIMITER } from "./constants";
import { A, R, RTE, TE, t, E } from "./fp";

enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE",
}

const formDataContentType = (formDataBoundaryString: string) => ({
	["Content-Type"]: `multipart/form-data; boundary=----${formDataBoundaryString}`,
});
const jsonContentType = { ["Content-Type"]: "application/json" };

const getFetchEnv = R.asks((d: BlogContext & PluginConfigContext) => ({
	baseUrl: d.blog.endpoint,
	apiKey: d.blog.apiKey,
	apiKeyHeader: d.pluginConfig.apiKeyHeader,
}));

const sendRequest = <T extends t.Props>(r: t.TypeC<T>) =>
	flow(
		fetchUrl,
		TE.chainEitherKW((res) =>
			pipe(
				r.decode(res.json),
				E.mapLeft(
					(errors) =>
						new DecodeError(
							errors,
							"Server response does not match schema. Please try updating the plugin."
						)
				)
			)
		)
	);

/**
 *
 *  Ping Blog (Get Blog Info)
 *
 */
export const blogSchema = t.type({
	id: t.string,
	name: t.string,
	subdomain: t.string,
});

const pingBlogResponse = t.type({
	blog: blogSchema,
});

export type Blog = t.TypeOf<typeof blogSchema>;

type PingBlogPayload = {
	syncFolder: string;
	apiKey: string;
	endpoint: string;
};

export const pingBlogFP = (payload: PingBlogPayload) =>
	pipe(
		RTE.asks(
			(d: AppContext & PluginConfigContext) => d.pluginConfig.apiKeyHeader
		),
		RTE.let("headers", (apiKeyHeader) => ({
			["Content-Type"]: "application/json",
			[apiKeyHeader]: payload.apiKey,
		})),
		RTE.let("url", () => payload.endpoint + "/ping"),
		RTE.let("method", () => HttpMethod.GET),
		RTE.chainTaskEitherK(sendRequest(pingBlogResponse))
	);

/**
 *
 *  Get File List
 *
 */
const serverFile = t.intersection([
	t.type({
		md5: t.string,
	}),
	t.partial({
		path: t.string,
		slug: t.string,
	}),
]);

export type ServerFile = t.TypeOf<typeof serverFile>;

const getFilesResponse = t.type({
	blog: t.type({ id: t.string }),
	posts: t.array(serverFile),
	assets: t.array(serverFile),
});

export const getFileListFp = pipe(
	getFetchEnv,
	R.map(({ baseUrl, apiKey, apiKeyHeader }) => ({
		headers: {
			...jsonContentType,
			[apiKeyHeader]: apiKey,
		},
		url: baseUrl + "/files",
		method: HttpMethod.GET,
	})),
	RTE.rightReader,
	RTE.chainTaskEitherK(sendRequest(getFilesResponse)),
	RTE.map(({ posts, assets }) => createServerMap([...posts, ...assets]))
);

const createServerMap = (serverFiles: ServerFile[]) => {
	const serverMap = new Map<string, string>();
	serverFiles.forEach(({ path, md5 }) => {
		if (path) {
			serverMap.set(path, md5);
		}
	});
	return serverMap;
};

/**
 *
 *  Delete files
 *
 */

type DeletePayload = {
	keys: string[];
};

export const deleteFiles = (p: DeletePayload) =>
	pipe(
		getFetchEnv,
		R.map(({ baseUrl, apiKey, apiKeyHeader }) => ({
			headers: {
				...jsonContentType,
				[apiKeyHeader]: apiKey,
			},
			body: JSON.stringify(p),
			url: baseUrl + "/files",
			method: HttpMethod.DELETE,
		})),
		RTE.rightReader,
		RTE.chainW(flow(fetchUrl, RTE.fromTaskEither))
	);

/**
 *
 *  Upload post
 *
 */

type UploadPostPayload = {
	type: "post";
	path: string;
	slug: string;
	content: string;
	md5: string;
};

const uploadPostResponse = t.type({
	slug: t.string,
});

export const uploadPost = (p: UploadPostPayload) =>
	pipe(
		getFetchEnv,
		R.map(({ baseUrl, apiKey, apiKeyHeader }) => ({
			headers: {
				...jsonContentType,
				[apiKeyHeader]: apiKey,
			},
			body: JSON.stringify(p),
			url: baseUrl + "/posts",
			method: HttpMethod.POST,
		})),
		RTE.rightReader,
		RTE.chainTaskEitherK(sendRequest(uploadPostResponse))
	);

const buildUploadMany =
	<T, R, A>(rte: (t: T) => RTE.ReaderTaskEither<R, Error, A>) =>
	(items: T[]) =>
		pipe(
			items,
			A.map((p) =>
				pipe(
					rte(p),
					RTE.bimap(
						() => errorResultM(p),
						() => successResultM<T, T>(p)
					)
				)
			),
			// sequentially for now. Look into batching later
			RTE.sequenceSeqArray,
			RTE.map(concatAll(resultM())),
			RTE.map(([uploaded, errored]) => ({ uploaded, errored }))
		);

export const uploadPosts = buildUploadMany(uploadPost);

/**
 *
 *  Upload asset
 *
 */
type UploadAssetPayload = {
	type: "asset";
	path: string;
	content: ArrayBuffer;
	md5: string;
};

export const uploadAsset = (p: UploadAssetPayload) => {
	const formDataBoundaryString =
		buildFormDataBoundaryString(FORM_DATA_DELIMITER);

	return pipe(
		getFetchEnv,
		R.map(({ baseUrl, apiKey, apiKeyHeader }) => ({
			headers: {
				...formDataContentType(formDataBoundaryString),
				[apiKeyHeader]: apiKey,
				["x-file-path"]: p.path,
				["x-file-md5"]: p.md5,
			},
			url: baseUrl + "/assets",
			method: HttpMethod.POST,
		})),
		RTE.rightReader,
		RTE.apSW("body", buildFormDataBody(p.content, formDataBoundaryString)),
		RTE.chainTaskEitherK(fetchUrl)
	);
};

const buildFormDataBoundaryString = (boundary: string, N: number = 16) => {
	return (
		boundary +
		Array(N + 1)
			.join(
				(Math.random().toString(36) + "00000000000000000").slice(2, 18)
			)
			.slice(0, N)
	);
};

export const uploadAssets = buildUploadMany(uploadAsset);

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

export const buildFormDataBody = pipe(
	TE.tryCatchK(encodeFormDataBody, (e) => {
		if (e instanceof Error) {
			return e;
		}
		return new Error("Encode form data faield");
	}),
	RTE.fromTaskEitherK
);
