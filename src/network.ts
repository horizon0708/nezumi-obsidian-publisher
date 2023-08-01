import * as R from "fp-ts/Reader";
import * as RS from "fp-ts/State";
import { flow } from "fp-ts/function";
import { pluginConfig } from "./plugin-config";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { requestUrl } from "obsidian";
import Logger from "js-logger";
import * as t from "io-ts";

type Dependencies = {
	baseUrl: string;
	apiKeyHeader: string;
	apiKeyValue: string;
};

type RequestParams = {
	url: string;
	headers: Record<string, string>;
	method: HttpMethod;
};
enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE",
}

type ParamBuilder = (
	params: RequestParams
) => R.Reader<Dependencies, RequestParams>;

const baseParams: RequestParams = {
	url: "",
	headers: {},
	method: HttpMethod.GET,
};

const putUrl =
	(endpoint: string): ParamBuilder =>
	(params) => {
		return R.asks((d) => ({
			...params,
			url: d.baseUrl + "/" + endpoint,
		}));
	};

const putJsonContentType: ParamBuilder = (params) => {
	return R.of({
		...params,
		headers: {
			["Content-Type"]: "application/json",
		},
	});
};

const putMethod =
	(method: HttpMethod): ParamBuilder =>
	(params: RequestParams) => {
		return R.of({
			...params,
			method,
		});
	};

const putApiKey: ParamBuilder = (params) => {
	return R.asks((d) => ({
		...params,
		headers: {
			...params.headers,
			[d.apiKeyHeader]: d.apiKeyValue,
		},
	}));
};

const fetchTE = TE.tryCatchK(requestUrl, (err: any) => {
	Logger.debug(err);
	// TODO: this should be better
	return {
		status: 500,
		error: err?.message,
	} as any;
});

const pingBlogResponse = t.type({
	blog: t.type({
		id: t.string,
		name: t.string,
		subdomain: t.string,
	}),
});

const b = pingBlogResponse.decode;

export const pingBlogFP = flow(
	flow(
		putUrl("ping"),
		R.chain(putJsonContentType),
		R.chain(putMethod(HttpMethod.GET)),
		R.chain(putApiKey)
	)(baseParams),
	fetchTE,
	TE.chain((e) => TE.fromEither(pingBlogResponse.decode(e?.json)))
);
