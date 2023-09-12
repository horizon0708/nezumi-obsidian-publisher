import { Manifest } from "src/commands/cpc/shared/manifest";
import { FType, LinkToPath, PFileWithMd5 } from "./shared/types";
import { A, O, R, RT, RTE, Separated, TE, flow, pipe } from "src/shared/fp";
import {
	UploadPayload,
	deleteAssets,
	deletePosts,
	uploadPayload,
} from "src/shared/network-new";
import { resolveLocalDeps } from "./temp-context";
import { cachedRead, readBinary } from "src/shared/obsidian-fp";

type UploadArgs = {
	left: Error[];
	right: PFileWithMd5[];
	manifest: Manifest;
};

type BuildUploadArgs = {
	args: UploadArgs;
};

/**
 * Build upload callback used by the confirmation modal
 */
export const buildUpload = () => {
	return pipe(
		callDelete,
		RTE.flatMap(() => RTE.ask<BuildUploadArgs>()),
		RTE.flatMapReaderTask((deps) => uploadMany(deps.args.right)),
		RTE.flatMapReader(flatten),
		resolveLocalDeps<UploadArgs>()
	);
};

// callDelete
const getPostsToDelete = ({ args: { manifest } }: BuildUploadArgs) =>
	TE.of(manifest.getItemsToDelete.posts.map((x) => x.slug));
const getAssetsToDelete = ({ args: { manifest } }: BuildUploadArgs) =>
	TE.of(manifest.getItemsToDelete.assets.map((x) => x.slug));

const callDelete = pipe(
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

// uploadMany
const replacePathWithSlug =
	(links: LinkToPath[]) =>
	({ args: { manifest } }: BuildUploadArgs) => {
		return pipe(
			links,
			A.map(({ link, path }) => {
				const slug = manifest.pathToSlug.get(path);
				return slug ? O.some({ link, slug }) : O.none;
			}),
			A.compact
		);
	};

const buildPostPayload = (pFile: PFileWithMd5) => {
	return pipe(
		{
			title: "stub title",
			slug: pFile.slug,
			md5: pFile.md5,
		},
		R.of,
		R.bind("links", () => replacePathWithSlug(pFile.links)),
		R.bind("embeds", () => replacePathWithSlug(pFile.embeds)),
		RTE.rightReader,
		RTE.bindW("markdown", () => cachedRead(pFile.file)),
		RTE.map((e) => e as UploadPayload)
	);
};
const buildAssetPayload = (pFile: PFileWithMd5) => {
	return pipe(
		readBinary(pFile.file),
		RTE.map(
			(content) =>
				({
					slug: pFile.slug,
					md5: pFile.md5,
					content,
				} as UploadPayload)
		)
	);
};

const buildPayload = (pFile: PFileWithMd5) => {
	if (pFile.type === FType.Post) {
		return buildPostPayload(pFile);
	}
	return buildAssetPayload(pFile);
};

const upload = flow(buildPayload, RTE.flatMap(uploadPayload));

const uploadMany = flow(
	A.map(upload),
	A.sequence(RT.ApplicativeSeq),
	RT.map(A.separate)
);

// flatten
const flatten =
	<A>(a: Separated.Separated<Error[], A[]>) =>
	({ args: { left } }: BuildUploadArgs) => ({
		left: [...left, ...a.left],
		right: a.right,
	});
