import { Manifest } from "src/commands/cpc/shared/manifest";
import { FType, LinkToPath, PFileWithMd5 } from "./shared/types";
import { A, O, R, RT, RTE, Separated, TE, flow, pipe } from "src/shared/fp";
import {
	UploadPayload,
	deleteAssets,
	deletePosts,
	uploadPayload,
} from "src/shared/network-new";
import { LocalDeps, addLocalContext } from "../../shared/add-local-context";
import { cachedRead, readBinary } from "src/shared/obsidian-fp";

type UploadArgs = {
	left: Error[];
	right: PFileWithMd5[];
	manifest: Manifest;
};
type LocalContext = LocalDeps<Manifest>;

/**
 * Build upload callback used by the confirmation modal
 */
export const buildUpload = ({ left, right, manifest }: UploadArgs) => {
	return pipe(
		callDelete,
		RTE.flatMapReaderTask(() => uploadMany(right)),
		RTE.map(flattenSeparated({ left, right })),
		RTE.let("manifest", () => manifest),
		addLocalContext(manifest)
	);
};

// callDelete
const getPostsToDelete = ({ args: manifest }: LocalContext) =>
	TE.of(manifest.getItemsToDelete.posts.map((x) => x.slug));
const getAssetsToDelete = ({ args: manifest }: LocalContext) =>
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
	({ args: manifest }: LocalContext) => {
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
const flattenSeparated =
	<A, B>(a: Separated.Separated<Error[], A[]>) =>
	(b: Separated.Separated<Error[], B[]>) => ({
		left: [...a.left, ...b.left],
		right: b.right,
	});
