import { getBlobArrayBuffer, requestUrl } from "obsidian";
import {
	BasePayload,
	DeletePayload,
	DeleteResponse,
	GetFileListResponse,
	PingRequest,
	PingResponse,
	UploadAssetPayload,
	UploadPostPayload,
	UploadResponse,
} from "./types";
import Logger from "js-logger";
import { buildPluginConfig } from "./plugin-config";

enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE",
}

const jsonContentType = { ["Content-Type"]: "application/json" };
const siteKeyHeader = (key: string) => ({
	[buildPluginConfig().apiKeyHeader]: key,
});

export const pingBlog = async (params: PingRequest): Promise<PingResponse> => {
	try {
		const baseUrl = params.endpoint ?? buildPluginConfig().baseUrl;
		return await requestUrl({
			url: `${baseUrl}/ping`,
			method: HttpMethod.GET,
			headers: {
				...jsonContentType,
				...siteKeyHeader(params.apiKey),
			},
		});
	} catch (e) {
		Logger.debug(e);
		return {
			status: 500,
			error: e.message,
		};
	}
};

export const getFileList = async (
	params: BasePayload
): Promise<GetFileListResponse> => {
	try {
		const baseUrl = params.endpoint ?? buildPluginConfig().baseUrl;

		return await requestUrl({
			url: `${baseUrl}/files`,
			method: HttpMethod.GET,
			headers: {
				...jsonContentType,
				...siteKeyHeader(params.apiKey),
			},
		});
	} catch (e) {
		Logger.debug(e);
		return {
			status: 500,
			error: e.message,
		};
	}
};

export const uploadPost = async (
	params: UploadPostPayload
): Promise<UploadResponse> => {
	try {
		const { endpoint, apiKey } = params;
		const baseUrl = endpoint ?? buildPluginConfig().baseUrl;
		return await requestUrl({
			url: `${baseUrl}/posts`,
			method: HttpMethod.POST,
			headers: {
				...jsonContentType,
				...siteKeyHeader(apiKey),
			},
			body: JSON.stringify(params),
		});
	} catch (e) {
		Logger.debug(e);
		return {
			status: 500,
			error: e.message,
		};
	}
};

export const uploadAssetDe = async (
	params: UploadAssetPayload
): Promise<UploadResponse> => {
	try {
		const { endpoint, apiKey, content, path, md5 } = params;
		const baseUrl = endpoint ?? buildPluginConfig().baseUrl;
		const boundaryString = buildRandomBoundaryString();
		return await requestUrl({
			url: `${baseUrl}/assets`,
			method: HttpMethod.POST,
			headers: {
				["content-type"]: `multipart/form-data; boundary=----${boundaryString}`,
				...siteKeyHeader(apiKey),
				["x-file-path"]: path,
				["x-file-md5"]: md5,
			},
			body: await buildFormDataBody(content, boundaryString),
		});
	} catch (e) {
		Logger.debug(e);
		return {
			status: 500,
			error: e.message,
		};
	}
};

export const deleteFiles = async (
	params: DeletePayload
): Promise<DeleteResponse> => {
	try {
		const { endpoint, apiKey } = params;
		const baseUrl = endpoint ?? buildPluginConfig().baseUrl;
		return await requestUrl({
			url: `${baseUrl}/files`,
			method: HttpMethod.DELETE,
			headers: {
				...jsonContentType,
				...siteKeyHeader(apiKey),
			},
			body: JSON.stringify(params),
		});
	} catch (e) {
		Logger.debug(e);
		return {
			status: 500,
			error: e.message,
		};
	}
};

function buildRandomBoundaryString() {
	const N = 16; // The length of our random boundry string
	return (
		buildPluginConfig().formDataBoundaryString +
		Array(N + 1)
			.join(
				(Math.random().toString(36) + "00000000000000000").slice(2, 18)
			)
			.slice(0, N)
	);
}

async function buildFormDataBody(
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
