import { Manifest } from "src/commands/confirm-push-changes/plan-upload/manifest";
import { PFile, PFileWithMd5 } from "../shared/types";
import { A, RT, RTE, Separated, pipe } from "src/shared/fp";
import {
	UploadPayload,
	deleteAssets,
	deletePosts,
	uploadPayload,
} from "src/shared/network-new";
import { buildPayload } from "../build-payload";

type UploadArgs = {
	left: Error[];
	right: PFileWithMd5[];
	manifest: Manifest;
};

/**
 * Build upload callback used by the confirmation modal
 */
export const buildUpload = ({ left, right, manifest }: UploadArgs) => {
	return pipe(
		callDeletes(manifest),
		RTE.flatMap(() => uploadMany(manifest)(right)),
		RTE.map(flatten({ left, right })),
		RTE.let("manifest", () => manifest)
	);
};

const flatten =
	<A, B>(a: Separated.Separated<Error[], A[]>) =>
	(b: Separated.Separated<Error[], B[]>) => ({
		left: [...a.left, ...b.left],
		right: b.right,
	});

const uploadMany = (manifest: Manifest) => (pFiles: PFileWithMd5[]) => {
	const upload = (pFile: PFileWithMd5) =>
		pipe(pFile, buildPayload(manifest), RTE.flatMap(uploadPayload));

	return pipe(
		pFiles,
		A.map(upload),
		A.sequence(RT.ApplicativeSeq),
		RT.map(A.separate),
		RTE.rightReaderTask
	);
};

const callDeletes = (manifest: Manifest) =>
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
