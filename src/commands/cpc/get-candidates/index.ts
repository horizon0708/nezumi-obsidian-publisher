import { TFile } from "obsidian";
import { A, R, RE, pipe } from "src/shared/fp";
import { getSlug } from "./get-slug";
import { getLinksToPaths } from "./get-links-to-paths";
import { FType, PFile } from "../shared/types";
import { getPostCandidates } from "./get-post-candidates";
import { getFile } from "src/shared/obsidian-fp";
import { separatedSemigroup } from "../shared/separate-errors";
import { FileProcessingError } from "src/shared/errors";

export const getCandidates = () =>
	pipe(
		RE.Do,
		RE.apSW("postCandidates", getPosts()),

		RE.bindW("assetCandidates", ({ postCandidates }) =>
			getAssets(postCandidates.right)
		),
		RE.map(({ postCandidates, assetCandidates }) =>
			separatedSemigroup<Error, PFile>().concat(
				postCandidates,
				assetCandidates
			)
		)
	);

const getPosts = () =>
	pipe(
		getPostCandidates(),
		RE.fromReader,
		RE.map(A.map(buildCandidate)),
		RE.flatMapReader(A.sequence(R.Applicative)),
		RE.map(A.separate<FileProcessingError, PFile>)
	);

const buildCandidate = (file: TFile) =>
	pipe(
		{
			file,
			type: file.extension === "md" ? FType.Post : FType.Asset,
		},
		R.of,
		R.apSW("slug", getSlug(file)),
		RE.fromReader,
		RE.apSW(
			"links",
			getLinksToPaths(file, (cm) => cm.links ?? [])
		),
		RE.apSW(
			"embeds",
			getLinksToPaths(file, (cm) => cm.embeds ?? [])
		),
		RE.mapLeft((e) => new FileProcessingError(file))
	);

const getAssetPaths = (files: PFile[]) => {
	const embeddedAssetPaths = new Set<string>();
	files.forEach((f) =>
		f.embeds.forEach((e) => {
			!e.path.endsWith(".md") && embeddedAssetPaths.add(e.path);
		})
	);
	return Array.from(embeddedAssetPaths);
};

const getAssets = (files: PFile[]) =>
	pipe(
		files,
		getAssetPaths,
		getFilesFromPaths,
		RE.rightReader,
		RE.map(A.map(buildCandidate)),
		RE.flatMapReader(A.sequence(R.Applicative)),
		RE.map(A.separate<FileProcessingError, PFile>)
	);

const getFilesFromPaths = (paths: string[]) =>
	pipe(paths, A.map(getFile), A.sequence(R.Applicative), R.map(A.compact));
