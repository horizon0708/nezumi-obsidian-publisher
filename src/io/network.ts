import * as r from "fp-ts/Record";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { flow, pipe } from "fp-ts/function";
import * as t from "io-ts";
import { Semigroup } from "fp-ts/lib/string";
import { concatAll } from "fp-ts/lib/Monoid";
import { successResultM, errorResultM, resultM } from "../utils";
import { buildFormDataBodyTE, fetchUrl } from "../shared/obsidian-fp";
import { AppContext, BaseContext } from "src/shared/types";
import { DecodeError } from "src/shared/errors";

enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE",
}

const headers = pipe(
	{
		jsonContentType: (d: BaseContext) => ({
			["Content-Type"]: "application/json",
		}),
		formDataContentType: (d: BaseContext) => ({
			["Content-Type"]: `multipart/form-data; boundary=----${d.pluginConfig.formDataBoundaryString}`,
		}),
		apiKey: (d: BaseContext) => ({
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
	RTE.asks((d: BaseContext) => d.blog.endpoint + "/" + ep);

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
		RTE.asks((d: AppContext) => d.pluginConfig.apiKeyHeader),
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
	RTE.Do,
	RTE.apSW("url", buildUrl("files")),
	RTE.apSW(
		"headers",
		buildHeaders([headers.jsonContentType, headers.apiKey])
	),
	RTE.apSW("method", RTE.of(HttpMethod.GET)),
	RTE.chainTaskEitherK(sendRequest(getFilesResponse))
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
		RTE.ask<BaseContext>(),
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
		RTE.chainTaskEitherKW(fetchUrl)
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
