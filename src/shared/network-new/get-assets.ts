import { R, RTE, pipe, t } from "../fp";
import {
	HttpMethod,
	getFetchEnv,
	jsonContentType,
	sendRequest,
	serverFile,
} from "./shared";

const getAssetsResponse = t.type({
	data: t.array(serverFile),
});

export const getAssets = pipe(
	getFetchEnv,
	R.map(({ baseUrl, apiKey, apiKeyHeader }) => ({
		headers: {
			...jsonContentType,
			[apiKeyHeader]: apiKey,
		},
		url: baseUrl + "/assets/sync",
		method: HttpMethod.GET,
	})),
	RTE.rightReader,
	RTE.chainTaskEitherK(sendRequest(getAssetsResponse)),
	RTE.map(({ data }) => data)
);
