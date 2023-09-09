import { t, pipe, R, RTE } from "../fp";
import {
	getFetchEnv,
	jsonContentType,
	HttpMethod,
	sendRequest,
} from "./shared";

type UploadPostPayload = {
	slug: string;
	md5: string;
	title: string;
	markdown: string;
	links: Record<string, string>;
};

const createPostResponse = t.type({
	slug: t.string,
});

export const createPost = (p: UploadPostPayload) =>
	pipe(
		getFetchEnv,
		R.map(({ baseUrl, apiKey, apiKeyHeader }) => ({
			headers: {
				...jsonContentType,
				[apiKeyHeader]: apiKey,
			},
			body: JSON.stringify({ post: p }),
			url: baseUrl + "/posts",
			method: HttpMethod.POST,
		})),
		RTE.rightReader,
		RTE.chainTaskEitherK(sendRequest(createPostResponse))
	);
