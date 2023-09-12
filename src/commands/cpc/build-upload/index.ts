import { Manifest } from "src/commands/cpc/shared/manifest";
import { PFileWithMd5 } from "../shared/types";
import { A, RT, RTE, Separated, pipe } from "src/shared/fp";
import {
	deleteAssets,
	deletePosts,
	uploadPayload,
} from "src/shared/network-new";
import { buildPayload } from "./build-payload";

type UploadArgs = {
	left: Error[];
	right: PFileWithMd5[];
	manifest: Manifest;
};

/**
 * Build upload callback used by the confirmation modal
 */
export const buildUpload = (args: UploadArgs) => {
	const { left, right, manifest } = args;
	const callDelete = buildCallDelete(args);
	const uploadMany = buildUploadMany(args);
	const flatten = buildFlatten({ left, right });

	return pipe(
		callDelete,
		RTE.flatMap(() => uploadMany),
		RTE.map(flatten),
		RTE.let("manifest", () => manifest)
	);
};

const buildFlatten =
	<A, B>(a: Separated.Separated<Error[], A[]>) =>
	(b: Separated.Separated<Error[], B[]>) => ({
		left: [...a.left, ...b.left],
		right: b.right,
	});

const buildUploadMany = ({ manifest, right }: UploadArgs) => {
	const upload = (pFile: PFileWithMd5) =>
		pipe(pFile, buildPayload(manifest), RTE.flatMap(uploadPayload));

	return pipe(
		right,
		A.map(upload),
		A.sequence(RT.ApplicativeSeq),
		RT.map(A.separate),
		RTE.rightReaderTask
	);
};

const buildCallDelete = ({ manifest }: UploadArgs) =>
	pipe(
		RTE.Do,
		RTE.let("postsToDelete", () =>
			manifest.getItemsToDelete.posts.map((x) => x.slug)
		),
		RTE.bind("postDeleteResult", ({ postsToDelete }) =>
			deletePosts({ slugs: postsToDelete })
		),
		RTE.let("assetsToDelete", () =>
			manifest.getItemsToDelete.posts.map((x) => x.slug)
		),
		RTE.bind("assetDeleteResult", ({ assetsToDelete }) =>
			deleteAssets({ slugs: assetsToDelete })
		)
	);
