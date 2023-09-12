import { A, O, R, RTE, pipe } from "src/shared/fp";
import { FType, LinkToPath, PFileWithMd5 } from "../shared/types";
import { cachedRead, readBinary } from "src/shared/obsidian-fp";
import { UploadPayload } from "src/shared/network-new";
import { BuildUploadArgs } from ".";

export const buildPayload = (pFile: PFileWithMd5) => {
	if (pFile.type === FType.Post) {
		return buildPostPayload(pFile);
	}
	return buildAssetPayload(pFile);
};

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
