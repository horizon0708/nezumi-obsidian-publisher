import { R, RTE, pipe, t } from "../fp";
import {
	HttpMethod,
	getFetchEnv,
	jsonContentType,
	sendRequest,
	serverFile,
} from "./shared";

const getPostsReponse = t.type({
	data: t.array(serverFile),
});

export const getPosts = pipe(
	getFetchEnv,
	R.map(({ baseUrl, apiKey, apiKeyHeader }) => ({
		headers: {
			...jsonContentType,
			[apiKeyHeader]: apiKey,
		},
		url: baseUrl + "/posts/sync",
		method: HttpMethod.GET,
	})),
	RTE.rightReader,
	RTE.chainTaskEitherK(sendRequest(getPostsReponse)),
	RTE.map(({ data }) => data)
);
