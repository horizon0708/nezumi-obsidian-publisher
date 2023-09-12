import { A, O, RT, RTE, TE, pipe } from "src/shared/fp";
import { Manifest } from "../../confirm-push-changes/plan-upload/manifest";
import { FType, LinkToPath, PFileWithMd5 } from "../shared/types";
import { cachedRead, readBinary } from "src/shared/obsidian-fp";
import { UploadPayload } from "src/shared/network-new";

export const buildPayload = (manifest: Manifest) => (pFile: PFileWithMd5) => {
	if (pFile.type === FType.Post) {
		return buildPostPayload(manifest)(pFile);
	}
	return buildAssetPayload(pFile);
};

const replacePathWithSlug = (manifest: Manifest) => (links: LinkToPath[]) => {
	return pipe(
		links,
		A.map(({ link, path }) => {
			const slug = manifest.pathToSlug.get(path);
			return slug ? O.some({ link, slug }) : O.none;
		}),
		A.compact
	);
};

const buildPostPayload = (manifest: Manifest) => (pFile: PFileWithMd5) => {
	const links = replacePathWithSlug(manifest)(pFile.links);
	const embeds = replacePathWithSlug(manifest)(pFile.embeds);
	// get title etc

	return pipe(
		cachedRead(pFile.file),
		RTE.map(
			(markdown) =>
				({
					title: "stub title",
					slug: pFile.slug,
					md5: pFile.md5,
					markdown,
					links,
					embeds,
				} as UploadPayload)
		)
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
