export type Blog = {
	id: number;
	name: string;
	apiKey: string;
	syncFolder: string;
	endpoint: string;
	subdomain: string;
};

export type FileUploadState = "pending" | "skipped" | "uploaded" | "failed";

export type PluginData = {
	blogs: Blog[];
};

export type ServerFile = { md5: string; path?: string; slug?: string };

export type ServerFileState = { md5: string; hasLocalCopy: boolean };

export type BasePayload = {
	apiKey: string;
	endpoint: string;
};

type ServerSuccessResponse<T> = {
	status: number;
	json: T;
};

type ServerFailureResponse = {
	status: number;
	error: string;
};

export type ServerResponse<T> =
	| ServerSuccessResponse<T>
	| ServerFailureResponse;

export type DeletePayload = BasePayload & { keys: string[] };

export type DeleteResponse = ServerResponse<{}>;

export type UploadPostPayload = BasePayload & {
	type: "post";
	path: string;
	slug: string;
	content: string;
	md5: string;
};

export type UploadAssetPayload = BasePayload & {
	type: "asset";
	path: string;
	slug: string;
	content: ArrayBuffer;
	md5: string;
};

export type UploadPayload = UploadPostPayload | UploadAssetPayload;

export type UploadResponse = ServerResponse<{ slug: string }>;

export type GetFileListResponse = ServerResponse<{
	blog: { id: number };
	files: ServerFile[];
}>;

export type PingRequest = {
	apiKey: string;
	endpoint?: string;
};
export type PingResponse = ServerResponse<{
	blog: Pick<Blog, "id" | "name" | "subdomain">;
}>;
