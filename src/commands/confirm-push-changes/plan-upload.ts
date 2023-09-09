import { pipe } from "fp-ts/lib/function";
import { getFileListFp } from "src/shared/network";
import { FileStatus, FileType, Item } from "../../shared/types";
import { Separated } from "fp-ts/lib/Separated";
import { A, E, NEA, O, R, RTE } from "src/shared/fp";
import { SlugMap } from "./plan-upload/slug-map";
import { ServerFile, getAssets, getPosts } from "src/shared/network-new";

export type UploadPlan = ReturnType<ReturnType<typeof sortItems>>;

export const planUpload = (itemResult: Separated<Error[], Item[]>) =>
	pipe(
		// getFileListFp,
		RTE.Do,
		RTE.apSW("posts", getPosts),
		RTE.apSW("assets", getAssets),
		RTE.map(({ posts, assets }) => createServerMap([...posts, ...assets])),
		RTE.map(sortItems(itemResult)),
		RTE.flatMapEither(checkConfirmationModalNeeded)
	);

export const createServerMap = (serverFiles: ServerFile[]) => {
	const serverMap = new Map<string, string>();
	serverFiles.forEach(({ slug, md5 }) => {
		if (slug) {
			serverMap.set(slug, md5);
		}
	});
	return serverMap;
};

type ServerFileMap = Map<string, string>;
const sortItems =
	({ left: errors, right: items }: Separated<Error[], Item[]>) =>
	(serverMap: Map<string, string>) => {
		const slugMap = new SlugMap();
		// These mutate the maps - but it's contained & necessary evil
		const updateFileStatus = (item: Item) => {
			return pipe(
				item,
				checkForSlugCollision,
				R.flatMap(checkForMD5Collision),
				R.flatMap(markItemOffFromServerMap)
			)({
				slugMap,
				serverMap,
			});
		};

		const postCount = items.filter(
			(item) => item.type === FileType.POST
		).length;

		return pipe(
			items,
			A.map(updateFileStatus),
			NEA.groupBy((item) => item.status),
			(groups) => ({
				pending: groups[FileStatus.PENDING] ?? [],
				md5Collision: groups[FileStatus.MD5_COLLISION] ?? [],
				slugCollision: groups[FileStatus.SLUG_COLLISION] ?? [],
				toDelete: Array.from(serverMap.keys()),
				fileErrors: groups[FileStatus.READ_ERROR] ?? [],
				errors: errors,
				totalCount: items.length,
				postCount: postCount,
				assetCount: items.length - postCount,
				slugMap: slugMap,
			})
		);
	};

type CheckContext = {
	serverMap: ServerFileMap;
	slugMap: SlugMap;
};

const checkForSlugCollision =
	(item: Item) =>
	({ slugMap }: CheckContext) => {
		if (FileStatus.PENDING) {
			const path = slugMap.getBySlug(item.slug);
			if (path && item.type === FileType.POST) {
				return {
					...item,
					status: FileStatus.SLUG_COLLISION,
					message: O.some(path),
				};
			}
			slugMap.set(item.slug, item.file.path);
		}
		return item;
	};

const checkForMD5Collision =
	(item: Item) =>
	({ serverMap }: CheckContext) => {
		const serverMd5 = serverMap.get(item.slug);
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
		const serverMd5 = serverMap.get(item.slug);
		if (serverMd5) {
			serverMap.delete(item.slug);
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
