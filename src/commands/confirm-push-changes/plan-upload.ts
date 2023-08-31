import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import { ServerFile, getFileListFp } from "src/shared/network";
import { FileStatus, FileType, Item } from "../../shared/types";
import * as A from "fp-ts/Array";
import * as O from "fp-ts/Option";
import * as NEA from "fp-ts/NonEmptyArray";
import { Separated } from "fp-ts/lib/Separated";
import { E, R } from "src/shared/fp";

export type UploadPlan = ReturnType<ReturnType<typeof sortItems>>;

export const planUpload = (itemResult: Separated<Error[], Item[]>) =>
	pipe(
		getFileListFp,
		RTE.map(sortItems(itemResult)),
		RTE.flatMapEither(checkConfirmationModalNeeded)
	);

type ServerFileMap = Map<string, string>;
const sortItems =
	({ left: errors, right: items }: Separated<Error[], Item[]>) =>
	(serverMap: Map<string, string>) => {
		const slugToPath = new Map<string, string>();
		// These mutate the maps - but it's contained & necessary evil
		const updateFileStatus = (item: Item) =>
			pipe(
				item,
				checkForSlugCollision,
				R.flatMap(checkForMD5Collision),
				R.flatMap(markItemOffFromServerMap)
			)({
				slugToPath,
				serverMap,
			});

		const postCount = items.filter(
			(item) => item.type === FileType.POST
		).length;

		return pipe(
			items,
			A.map(updateFileStatus),
			NEA.groupBy((item) => item.status),
			(groups) => ({
				pending: groups[FileStatus.PENDING],
				md5Collision: groups[FileStatus.MD5_COLLISION],
				slugCollision: groups[FileStatus.SLUG_COLLISION],
				toDelete: Array.from(serverMap.keys()),
				fileErrors: groups[FileStatus.READ_ERROR],
				errors: errors,
				totalCount: items.length,
				postCount: postCount,
				assetCount: items.length - postCount,
			})
		);
	};

type CheckContext = {
	serverMap: ServerFileMap;
	slugToPath: Map<string, string>;
};

const checkForSlugCollision =
	(item: Item) =>
	({ slugToPath }: CheckContext) => {
		if (item.type === FileType.POST && FileStatus.PENDING) {
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
		return item;
	};

const checkForMD5Collision =
	(item: Item) =>
	({ serverMap }: CheckContext) => {
		const serverMd5 = serverMap.get(item.serverPath);
		if (
			serverMd5 &&
			serverMd5 === item.md5 &&
			item.status === FileStatus.PENDING
		) {
			return {
				...item,
				status: FileStatus.MD5_COLLISION,
			};
		}
		return item;
	};

const markItemOffFromServerMap =
	(item: Item) =>
	({ serverMap }: CheckContext) => {
		const serverMd5 = serverMap.get(item.serverPath);
		if (serverMd5) {
			serverMap.delete(item.serverPath);
		}
		return item;
	};

const checkConfirmationModalNeeded = E.fromPredicate(
	(plan: UploadPlan) =>
		plan.pending.length > 0 ||
		plan.toDelete.length > 0 ||
		// if there are any file errors or slug collisions, lets show friendly modal
		plan.fileErrors.length > 0 ||
		plan.slugCollision.length > 0,
	(plan) =>
		new Error(
			plan.md5Collision
				? "No changes to upload"
				: "Couldn't find any files to upload!"
		)
);
