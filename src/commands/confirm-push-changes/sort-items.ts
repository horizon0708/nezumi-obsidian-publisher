import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import { getFileListFp } from "src/shared/network";
import { FileStatus, FileType, Item } from "../../shared/types";
import * as A from "fp-ts/Array";
import * as O from "fp-ts/Option";
import { Separated } from "fp-ts/lib/Separated";

export type UploadPlan = {
	errors: Error[];
	toSkip: Item[];
	toUpload: Item[];
	toDelete: string[];
};

export const sortItems = ({ left, right }: Separated<Error[], Item[]>) =>
	pipe(
		RTE.Do,
		RTE.apSW(
			"serverFiles",
			pipe(
				getFileListFp,
				RTE.map(({ posts, assets }) => [...posts, ...assets])
			)
		),
		RTE.map(({ serverFiles }) => {
			const serverMap = new Map<string, string>();
			serverFiles.forEach(({ path, md5 }) => {
				if (path) {
					serverMap.set(path, md5);
				}
			});
			const items = updateItemStatuses(serverMap)(right);

			const { left: toSkip, right: toUpload } = A.partition(
				(item: Item) => item.status === FileStatus.PENDING
			)(items);

			return {
				errors: left,
				items,
				toSkip,
				toUpload,
				toDelete: Array.from(serverMap.keys()),
			};
		})
	);

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
