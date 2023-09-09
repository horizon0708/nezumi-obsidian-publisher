import { getBlobArrayBuffer } from "obsidian";
import { FORM_DATA_DELIMITER } from "../constants";
import { pipe, R, RTE, TE } from "../fp";
import { fetchUrl } from "../obsidian-fp";
import { getFetchEnv, HttpMethod } from "./shared";

/**
 *
 *  Upload asset
 *
 */
type UploadAssetPayload = {
	content: ArrayBuffer;
	md5: string;
	slug: string;
};

export const createAsset = (p: UploadAssetPayload) => {
	const formDataBoundaryString =
		buildFormDataBoundaryString(FORM_DATA_DELIMITER);

	return pipe(
		getFetchEnv,
		R.map(({ baseUrl, apiKey, apiKeyHeader }) => ({
			headers: {
				[apiKeyHeader]: apiKey,
				["Content-Type"]: `multipart/form-data; boundary=----${formDataBoundaryString}`,
				["x-file-slug"]: p.slug,
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

const buildFormDataBody = pipe(
	TE.tryCatchK(encodeFormDataBody, (e) => {
		if (e instanceof Error) {
			return e;
		}
		return new Error("Encode form data faield");
	}),
	RTE.fromTaskEitherK
);

// IMPROVEMENT: This should be in a separate module
async function encodeFormDataBody(
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
