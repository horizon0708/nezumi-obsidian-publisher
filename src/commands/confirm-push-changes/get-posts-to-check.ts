import { TFile } from "obsidian";
import { R, A, r, pipe, RE } from "src/shared/fp";
import { getFiles } from "src/shared/obsidian-fp";
import { BlogContext, FileType } from "src/shared/types";
import { getType } from "src/shared/utils";

export const getPostsToCheck = () =>
	pipe(
		getFiles,
		R.bindTo("files"),
		R.apSW(
			"syncFolder",
			R.asks((ctx: BlogContext) => ctx.blog.syncFolder)
		),
		R.map(({ files, syncFolder }) =>
			pipe(files, A.filter(isPostAndInsideSyncFolder(syncFolder)))
		)
	);

const isPostAndInsideSyncFolder = (syncFolder: string) => (file: TFile) =>
	getType(file) === FileType.POST && file.path.startsWith(syncFolder);
