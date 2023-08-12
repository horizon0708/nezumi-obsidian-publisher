import { flow, pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import { getFileListFp } from "src/io/network";
import {
	BaseContext,
	FileStatus,
	FileType,
	Item,
	ServerFileState,
} from "../types";
import * as A from "fp-ts/Array";
import * as O from "fp-ts/Option";
import { getFile, getFiles } from "src/io/obsidian-fp";
import { buildItems } from "./build-items";
import { getType } from "src/utils";

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
		RTE.apSW(
			"posts",
			pipe(getSyncCandidateFiles, RTE.chainReaderTaskK(buildItems))
		),
		RTE.let("embeddedAssets", ({ posts: { right } }) =>
			getEmbeddedAssets(right)
		),
		RTE.bindW("assets", ({ embeddedAssets }) =>
			pipe(
				Array.from(embeddedAssets),
				A.map(RTE.fromReaderK(getFile)),
				RTE.sequenceArray,
				RTE.map((arr) => A.compact(Array.from(arr))),
				RTE.chainReaderTaskKW(buildItems)
			)
		),
		RTE.map(({ posts, assets, serverFiles }) => {
			const serverMap = new Map<string, ServerFileState>();
			serverFiles.forEach(({ path, md5 }) => {
				if (path) {
					serverMap.set(path, { md5, hasLocalCopy: false });
				}
			});
			const items = updateItemStatuses(serverMap)([
				...posts.right,
				...assets.right,
			]);
			const toDelete: string[] = [];
			serverMap.forEach((value, key) => {
				if (!value.hasLocalCopy) {
					toDelete.push(key);
				}
			});

			return {
				errors: [...posts.left, ...assets.left],
				items,
				toDelete,
			};
		})
	);

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
	(serverFiles: Map<string, ServerFileState>) => (items: Item[]) => {
		const slugToPath = new Map<string, string>();
		return items.map((item) => {
			const serverFile = serverFiles.get(item.serverPath);
			if (serverFile) {
				serverFile.hasLocalCopy = true;
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

			if (serverFile && serverFile.md5 === item.md5) {
				return {
					...item,
					status: FileStatus.MD5_COLLISION,
				};
			}

			return item;
		});
	};
