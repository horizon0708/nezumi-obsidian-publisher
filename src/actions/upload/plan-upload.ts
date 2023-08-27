import { flow, pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import { getFileListFp } from "src/io/network";
import { BaseContext, FileStatus, FileType, Item } from "../types";
import * as A from "fp-ts/Array";
import * as O from "fp-ts/Option";
import { getFile, getFiles } from "src/io/obsidian-fp";
import { buildItemsRTE } from "./build-items";
import { getType } from "src/utils";
import { showErrorNoticeRTE } from "src/shared/notifications";
import { appendLog } from "src/shared/plugin-data";

export const planUpload = () =>
	pipe(
		RTE.Do,
		RTE.apSW(
			"serverFiles",
			pipe(
				getFileListFp,
				RTE.map(({ posts, assets }) => [...posts, ...assets])
			)
		),
		RTE.apSW("posts", pipe(getSyncCandidateFiles, buildItemsRTE)),
		RTE.let("embeddedAssets", ({ posts: { right } }) =>
			getEmbeddedAssets(right)
		),
		RTE.bindW("assets", ({ embeddedAssets }) =>
			pipe(
				Array.from(embeddedAssets),
				A.map(RTE.fromReaderK(getFile)),
				RTE.sequenceArray,
				RTE.map((arr) => A.compact(Array.from(arr))),
				buildItemsRTE
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

			return {
				errors: [...posts.left, ...assets.left],
				items,
				toDelete: Array.from(serverMap.keys()),
			};
		}),
		RTE.tap(logPlanResult),
		RTE.tapError(showErrorNoticeRTE)
	);

type LogPlanResultArgs = { errors: Error[]; items: Item[]; toDelete: string[] };
const logPlanResult = ({ errors, items, toDelete }: LogPlanResultArgs) => {
	const errorStrings = errors.map((e) => e.message);
	const itemStrings = items.map((i) => `${i.file.path} - ${i.status}`);
	const deleteString = `deleting ${
		toDelete.length
	} files from server: ${toDelete.join(", ")}`;
	const logString = [
		"--- Upload Plan Start ---",
		...errorStrings,
		...itemStrings,
		deleteString,
		"--- Upload Plan End ---",
	];

	return pipe(logString, A.map(appendLog), RTE.sequenceSeqArray);
};

const getSyncCandidateFiles = pipe(
	RTE.ask<BaseContext>(),
	RTE.chainW(({ blog: { syncFolder } }) =>
		pipe(
			getFiles,
			RTE.fromReader,
			RTE.map(
				A.filter(
					(file) =>
						getType(file.path) === FileType.POST &&
						file.path.startsWith(syncFolder)
				)
			)
		)
	)
);

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
