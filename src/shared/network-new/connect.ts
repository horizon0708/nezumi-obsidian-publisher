import { t, pipe, RTE } from "../fp";
import { AppContext, PluginConfigContext } from "../types";
import { HttpMethod, sendRequest } from "./shared";

export const blogSchema = t.type({
	id: t.string,
	name: t.string,
	subdomain: t.string,
});

const pingBlogResponse = t.type({
	data: blogSchema,
});

export type Blog = t.TypeOf<typeof blogSchema>;

type PingBlogPayload = {
	syncFolder: string;
	apiKey: string;
	endpoint: string;
};

export const connect = (payload: PingBlogPayload) =>
	pipe(
		RTE.asks(
			(d: AppContext & PluginConfigContext) => d.pluginConfig.apiKeyHeader
		),
		RTE.let("headers", (apiKeyHeader) => ({
			["Content-Type"]: "application/json",
			[apiKeyHeader]: payload.apiKey,
		})),
		RTE.let("url", () => payload.endpoint + "/connect"),
		RTE.let("method", () => HttpMethod.GET),
		RTE.chainTaskEitherK(sendRequest(pingBlogResponse))
	);
