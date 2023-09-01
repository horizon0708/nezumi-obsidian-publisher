import { TFile } from "obsidian";
import { R, A, r, pipe } from "src/shared/fp";
import { getFiles, getFile, getResolvedLinks } from "src/shared/obsidian-fp";
import { BlogContext, FileType } from "src/shared/types";
import { getType } from "src/shared/utils";

export const getFilesToCheck = () =>
	pipe(
		getFiles,
		R.bindTo("files"),
		R.apSW(
			"syncFolder",
			R.asks((ctx: BlogContext) => ctx.blog.syncFolder)
		),
		R.map(({ files, syncFolder }) =>
			pipe(files, A.filter(isPostAndInsideSyncFolder(syncFolder)))
		),
		R.flatMap(addEmbeddedAssets)
	);

const addEmbeddedAssets = (posts: TFile[]) =>
	pipe(
		posts,
		A.map(getEmbeddedAssets),
		A.sequence(R.Applicative),
		R.map(concatSets),
		R.map((f) => Array.from(f)),
		R.flatMap(getFilesFromPaths),
		R.map((assets) => [...posts, ...assets])
	);

const getFilesFromPaths = (paths: string[]) =>
	pipe(paths, A.map(getFile), A.sequence(R.Applicative), R.map(A.compact));

// apparently this is fastest
// https://stackoverflow.com/a/50296208
const concatSets = <T>(sets: Set<T>[]) => {
	const set = new Set<T>();
	for (const iterable of sets) {
		for (const item of iterable) {
			set.add(item);
		}
	}
	return set;
};

const getEmbeddedAssets = (file: { path: string }) =>
	pipe(
		getResolvedLinks(file.path),
		R.map((links) =>
			pipe(
				links,
				r.toArray,
				A.filter(([path, n]) => getType(path) === FileType.ASSET),
				A.map(([path, n]) => path),
				(paths) => new Set<string>(paths)
			)
		)
	);

const isPostAndInsideSyncFolder = (syncFolder: string) => (file: TFile) =>
	getType(file.path) === FileType.POST && file.path.startsWith(syncFolder);
