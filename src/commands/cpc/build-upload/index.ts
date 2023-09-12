import { Manifest } from "src/commands/cpc/shared/manifest";
import { PFileWithMd5 } from "../shared/types";
import { A, R, RT, RTE, Separated, TE, flow, pipe } from "src/shared/fp";
import {
	deleteAssets,
	deletePosts,
	uploadPayload,
} from "src/shared/network-new";
import { buildPayload } from "./build-payload";
import { resolveLocalDeps } from "../temp-context";

type UploadArgs = {
	left: Error[];
	right: PFileWithMd5[];
	manifest: Manifest;
};

export type BuildUploadArgs = {
	args: UploadArgs;
};

/**
 * Build upload callback used by the confirmation modal
 */
export const buildUpload = () => {
	return pipe(
		buildCallDelete,
		RTE.flatMap(() => RTE.ask<BuildUploadArgs>()),
		RTE.flatMapReaderTask((deps) => buildUploadMany(deps.args.right)),
		RTE.flatMapReader(buildFlatten),
		resolveLocalDeps<BuildUploadArgs>()
	);
};

const getPostsToDelete = ({ args: { manifest } }: BuildUploadArgs) =>
	TE.of(manifest.getItemsToDelete.posts.map((x) => x.slug));
const getAssetsToDelete = ({ args: { manifest } }: BuildUploadArgs) =>
	TE.of(manifest.getItemsToDelete.assets.map((x) => x.slug));

const buildCallDelete = pipe(
	RTE.Do,
	RTE.apSW("postsToDelete", getPostsToDelete),
	RTE.bindW("postDeleteResult", ({ postsToDelete }) =>
		deletePosts({ slugs: postsToDelete })
	),
	RTE.apSW("assetsToDelete", getAssetsToDelete),
	RTE.bindW("assetDeleteResult", ({ assetsToDelete }) =>
		deleteAssets({ slugs: assetsToDelete })
	)
);

const upload = flow(buildPayload, RTE.flatMap(uploadPayload));

const buildUploadMany = flow(
	A.map(upload),
	A.sequence(RT.ApplicativeSeq),
	RT.map(A.separate)
);

const buildFlatten =
	<A>(a: Separated.Separated<Error[], A[]>) =>
	({ args: { left } }: BuildUploadArgs) => ({
		left: [...left, ...a.left],
		right: a.right,
	});
