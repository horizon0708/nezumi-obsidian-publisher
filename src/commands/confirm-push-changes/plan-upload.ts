import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import { getFileListFp } from "src/shared/network";
import { BlogContext, FileStatus, FileType, Item } from "../../shared/types";
import * as A from "fp-ts/Array";
import * as O from "fp-ts/Option";
import { getFile, getFiles } from "src/shared/obsidian-fp";
import { getType } from "src/shared/utils";
import { showErrorNoticeRTE } from "src/shared/obsidian-fp/notifications";
import { TFile } from "obsidian";
import { Separated } from "fp-ts/lib/Separated";
import { ConfirmPushChangesContext } from "../confirm-push-changes";

type FileProcessor = (
	files: TFile[]
) => RTE.ReaderTaskEither<
	ConfirmPushChangesContext,
	never,
	Separated<Error[], Item[]>
>;

export type UploadPlan = {
	errors: Error[];
	toSkip: Item[];
	toUpload: Item[];
	toDelete: string[];
};

export const planUpload = (processFiles: FileProcessor) =>
	pipe(
		RTE.Do,
		RTE.apSW(
			"serverFiles",
			pipe(
				getFileListFp,
				RTE.map(({ posts, assets }) => [...posts, ...assets])
			)
		),
		RTE.apSW("posts", getPostsToUpload(processFiles)),
		RTE.let("embeddedAssets", ({ posts: { right } }) =>
			getEmbeddedAssets(right)
		),
		RTE.bindW("assets", ({ embeddedAssets }) =>
			pipe(
				Array.from(embeddedAssets),
				A.map(RTE.fromReaderK(getFile)),
				RTE.sequenceArray,
				RTE.map((arr) => A.compact(Array.from(arr))),
				RTE.chainW(processFiles)
			)
		),
		RTE.map(({ posts, assets, serverFiles }) => {
			const serverMap = new Map<string, string>();
			serverFiles.forEach(({ path, md5 }) => {
				if (path) {
					serverMap.set(path, md5);
				}
			});
			const items = updateItemStatuses(serverMap)([
				...posts.right,
				...assets.right,
			]);

			const { left: toSkip, right: toUpload } = A.partition(
				(item: Item) => item.status === FileStatus.PENDING
			)(items);

			return {
				errors: [...posts.left, ...assets.left],
				items,
				toSkip,
				toUpload,
				toDelete: Array.from(serverMap.keys()),
			};
		}),
		// RTE.tap(logPlanResult),
		RTE.tapError(showErrorNoticeRTE)
	);

const getPostsToUpload = (processor: FileProcessor) =>
	pipe(
		RTE.ask<BlogContext>(),
		RTE.chainW(({ blog: { syncFolder } }) =>
			pipe(
				getFiles,
				RTE.fromReader,
				RTE.map(A.filter(isPostAndInsideSyncFolder(syncFolder)))
			)
		),
		RTE.chain(processor)
	);

const isPostAndInsideSyncFolder = (syncFolder: string) => (file: TFile) =>
	getType(file.path) === FileType.POST && file.path.startsWith(syncFolder);

const getEmbeddedAssets = (items: Item[]) => {
	const embeddedAssets = new Set<string>();
	items.forEach((item) => {
		if (item.type === FileType.POST) {
			item.embeddedAssets.forEach((asset) => {
				embeddedAssets.add(asset);
			});
		}
	});
	return embeddedAssets;
};

const updateItemStatuses =
	(serverFiles: Map<string, string>) => (items: Item[]) => {
		const slugToPath = new Map<string, string>();
		return items.map((item) => {
			const serverMd5 = serverFiles.get(item.serverPath);
			if (serverMd5) {
				serverFiles.delete(item.serverPath);
			}

			if (item.type === FileType.POST) {
				const path = slugToPath.get(item.slug);
				if (path) {
					return {
						...item,
						status: FileStatus.SLUG_COLLISION,
						message: O.some(path),
					};
				}
				slugToPath.set(item.slug, item.file.path);
			}

			if (serverMd5 && serverMd5 === item.md5) {
				return {
					...item,
					status: FileStatus.MD5_COLLISION,
				};
			}

			return item;
		});
	};
