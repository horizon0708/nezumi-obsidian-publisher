import { t, pipe, R, RTE } from "../fp";
import { fetchUrl } from "../obsidian-fp";
import {
	getFetchEnv,
	jsonContentType,
	HttpMethod,
	sendRequest,
} from "./shared";

export type CreatePostPayload = {
	slug: string;
	md5: string;
	title: string;
	markdown: string;
	links: { link: string; slug: string }[];
	embeds: { link: string; slug: string }[];
};

const createPostResponse = t.type({
	slug: t.string,
});

export const createPost = (p: CreatePostPayload) =>
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
		RTE.chainTaskEitherK(fetchUrl)
		// RTE.chainTaskEitherK(sendRequest(createPostResponse))
	);
