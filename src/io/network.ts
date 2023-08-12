import * as r from "fp-ts/Record";
import * as A from "fp-ts/Array";
import * as RTE from "fp-ts/ReaderTaskEither";
import { flow, pipe } from "fp-ts/function";
import * as t from "io-ts";
import { Semigroup } from "fp-ts/lib/string";
import { concatAll } from "fp-ts/lib/Monoid";
import { buildPluginConfig } from "../plugin-config";
import { successResultM, errorResultM, resultM } from "../utils";
import { buildFormDataBodyTE, fetchUrl } from "./obsidian-fp2";

type Dependencies = {
	blog: Blog;
	pluginConfig: ReturnType<typeof buildPluginConfig>;
};

enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE",
}

const headers = pipe(
	{
		jsonContentType: (d: Dependencies) => ({
			["Content-Type"]: "application/json",
		}),
		formDataContentType: (d: Dependencies) => ({
			["Content-Type"]: `multipart/form-data; boundary=----${d.pluginConfig.formDataBoundaryString}`,
		}),
		apiKey: (d: Dependencies) => ({
			[d.pluginConfig.apiKeyHeader]: d.blog.apiKey,
		}),
	},
	r.map(RTE.asks)
);

const headersFromPayload = ({ path, md5 }: { path: string; md5: string }) =>
	pipe(
		{
			path: { ["x-file-path"]: path },
			md5: { ["x-file-md5"]: md5 },
		},
		r.map(RTE.of)
	);

const buildHeaders = <T>(
	builders: RTE.ReaderTaskEither<T, never, Record<string, string>>[]
) =>
	pipe(
		builders,
		RTE.sequenceArray,
		RTE.map(concatAll(r.getMonoid(Semigroup)))
	);

const buildUrl = (ep: string) =>
	RTE.asks((d: Dependencies) => d.blog.endpoint + "/" + ep);

const sendRequest = <T extends t.Props>(r: t.TypeC<T>) =>
	flow(
		fetchUrl,
		RTE.fromTaskEither,
		RTE.chainW((response) => pipe(response.json, r.decode, RTE.fromEither))
	);

/**
 *
 *  Ping Blog (Get Blog Info)
 *
 */
const blog = t.type({
	id: t.string,
	name: t.string,
	subdomain: t.string,
	syncFolder: t.string,
	endpoint: t.string,
	apiKey: t.string,
});

const pingBlogResponse = t.type({
	blog,
});

export type Blog = t.TypeOf<typeof blog>;

export const pingBlogFP = pipe(
	RTE.Do,
	RTE.apSW(
		"headers",
		buildHeaders([headers.jsonContentType, headers.apiKey])
	),
	RTE.apSW("url", buildUrl("ping")),
	RTE.let("method", () => HttpMethod.GET),
	RTE.chainW(sendRequest(pingBlogResponse))
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
	RTE.Do,
	RTE.apSW("url", buildUrl("files")),
	RTE.apSW(
		"headers",
		buildHeaders([headers.jsonContentType, headers.apiKey])
	),
	RTE.apSW("method", RTE.of(HttpMethod.GET)),
	RTE.chainW(sendRequest(getFilesResponse))
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
		RTE.Do,
		RTE.apSW("body", RTE.of(JSON.stringify(p))),
		RTE.apSW("url", buildUrl("posts")),
		RTE.apSW(
			"headers",
			buildHeaders([headers.jsonContentType, headers.apiKey])
		),
		RTE.apSW("method", RTE.of(HttpMethod.POST)),
		RTE.chainW(sendRequest(uploadPostResponse))
	);

const buildUploadMany =
	<T, R, A>(rte: (t: T) => RTE.ReaderTaskEither<R, unknown, A>) =>
	(items: T[]) =>
		pipe(
			items,
			A.map((p) =>
				pipe(
					rte(p),
					RTE.chain(() => RTE.of(successResultM<T, T>(p))),
					RTE.orElse(() => RTE.of(errorResultM(p)))
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

const buildAssetBody = (p: UploadAssetPayload) =>
	pipe(
		RTE.ask<Dependencies>(),
		RTE.chainW((d) =>
			pipe(
				buildFormDataBodyTE(
					p.content,
					d.pluginConfig.formDataBoundaryString
				),
				RTE.fromTaskEither
			)
		)
	);

export const uploadAsset = (p: UploadAssetPayload) =>
	pipe(
		RTE.Do,
		RTE.apSW("body", buildAssetBody(p)),
		RTE.apSW("url", buildUrl("assets")),
		RTE.apSW(
			"headers",
			buildHeaders([
				headers.formDataContentType,
				headers.apiKey,
				headersFromPayload(p).path,
				headersFromPayload(p).md5,
			])
		),
		RTE.apSW("method", RTE.of(HttpMethod.POST)),
		RTE.chainW(flow(fetchUrl, RTE.fromTaskEither))
	);

export const uploadAssets = buildUploadMany(uploadAsset);

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
		RTE.Do,
		RTE.apSW("body", RTE.of(JSON.stringify(p))),
		RTE.apSW("url", buildUrl("files")),
		RTE.apSW(
			"headers",
			buildHeaders([headers.jsonContentType, headers.apiKey])
		),
		RTE.apSW("method", RTE.of(HttpMethod.DELETE)),
		RTE.chainW(flow(fetchUrl, RTE.fromTaskEither))
	);
