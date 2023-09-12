import { pipe } from "../fp";
import { CreateAssetPayload, createAsset } from "./create-asset";
import { CreatePostPayload, createPost } from "./create-post";

export * from "./shared";
export * from "./create-asset";
export * from "./get-assets";
export * from "./delete-assets";

export * from "./create-post";
export * from "./get-posts";
export * from "./delete-posts";

export type UploadPayload = CreatePostPayload | CreateAssetPayload;

export const uploadPayload = (payload: UploadPayload) => {
	if (isPostPayload(payload)) {
		return pipe(payload, createPost);
	}
	return createAsset(payload);
};

const isPostPayload = (
	payload: UploadPayload
): payload is CreatePostPayload => {
	return "title" in payload;
};
