import { TFile } from "obsidian";
import { R, A, r, pipe, RE, O } from "src/shared/fp";
import { getFM, getFiles } from "src/shared/obsidian-fp";
import { BlogContext, FileType, PluginConfigContext } from "src/shared/types";
import { PFile } from "../shared/types";

export const getPostCandidates = () =>
	pipe(
		getFiles,
		R.bindTo("files"),
		R.apSW(
			"syncFolder",
			R.asks((ctx: BlogContext) => ctx.blog.syncFolder)
		),
		R.map(({ files, syncFolder }) =>
			getPostsInsideSyncFolder(files, syncFolder)
		)
	);

const getPostsInsideSyncFolder = (files: TFile[], syncFolder: string) =>
	files.filter((file) => {
		return file.extension == "md" && file.path.startsWith(syncFolder);
	});
