import { TFile } from "obsidian";
import { A, R, RE, RTE, pipe } from "src/shared/fp";
import { getSlug } from "./get-slug";
import { getLinksToPaths } from "./get-links-to-paths";
import { FType, PFile } from "../shared/types";
import { getFile, getFiles } from "src/shared/obsidian-fp";
import { separatedSemigroup } from "../shared/separate-errors";
import { FileProcessingError } from "src/shared/errors";
import { BlogContext } from "src/shared/types";

export const getCandidates = () =>
	pipe(
		RE.Do,
		RE.apSW("postCandidates", getPosts),
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

// getPosts
const postsInsideSyncFolder =
	(files: TFile[]) =>
	({ blog: { syncFolder } }: BlogContext) => {
		return files.filter((file) => {
			return file.extension == "md" && file.path.startsWith(syncFolder);
		});
	};

const buildCandidate = (file: TFile) =>
	pipe(
		{
			file,
			type: file.extension === "md" ? FType.Post : FType.Asset,
		},
		R.of,
		R.apSW("slug", getSlug(file)),
		RE.fromReader,
		RE.apSW("links", getLinksToPaths(file, "links")),
		RE.apSW("embeds", getLinksToPaths(file, "embeds")),
		RE.mapLeft((e) => new FileProcessingError(file))
	);

const getPosts = pipe(
	getFiles,
	R.flatMap(postsInsideSyncFolder),
	RE.fromReader,
	RE.map(A.map(buildCandidate)),
	RE.flatMapReader(A.sequence(R.Applicative)),
	RE.map(A.separate<FileProcessingError, PFile>)
);

// getAssets
const getAssetPaths = (files: PFile[]) => {
	const embeddedAssetPaths = new Set<string>();
	files.forEach((f) =>
		f.embeds.forEach((e) => {
			!e.path.endsWith(".md") && embeddedAssetPaths.add(e.path);
		})
	);
	return Array.from(embeddedAssetPaths);
};

const getFilesFromPaths = (paths: string[]) =>
	pipe(paths, A.map(getFile), A.sequence(R.Applicative), R.map(A.compact));

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
