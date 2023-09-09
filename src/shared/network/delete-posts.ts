import { flow } from "fp-ts/lib/function";
import { pipe, R, RTE } from "../fp";
import { fetchUrl } from "../obsidian-fp";
import { getFetchEnv, jsonContentType, HttpMethod } from "./shared";

type DeletePayload = {
	slugs: string[];
};

export const deletePosts = (p: DeletePayload) =>
	pipe(
		getFetchEnv,
		R.map(({ baseUrl, apiKey, apiKeyHeader }) => ({
			headers: {
				...jsonContentType,
				[apiKeyHeader]: apiKey,
			},
			body: JSON.stringify(p),
			url: baseUrl + "/posts",
			method: HttpMethod.DELETE,
		})),
		RTE.rightReader,
		RTE.chainW(flow(fetchUrl, RTE.fromTaskEither))
	);
