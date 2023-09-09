import { pipe } from "fp-ts/lib/function";
import { FileStatus, FileType, Item } from "../../shared/types";
import { Separated } from "fp-ts/lib/Separated";
import { A, E, NEA, O, R, RTE } from "src/shared/fp";
import { SlugMap } from "./plan-upload/slug-map";
import { getAssets, getPosts } from "src/shared/network-new";
import { ServerMap } from "./plan-upload/server-map";

export type UploadPlan = ReturnType<ReturnType<typeof sortItems>>;

type PlanUploadArgs = {
	posts: Separated<Error[], Item[]>;
	assets: Separated<Error[], Item[]>;
};

export type UploadPlans = {
	postPlan: UploadPlan;
	assetPlan: UploadPlan;
};

export const planUpload = ({ posts, assets }: PlanUploadArgs) =>
	pipe(
		RTE.Do,
		RTE.apSW("postPlan", planPostUpload(posts)),
		RTE.apSW("assetPlan", planAssetUpload(assets)),
		RTE.flatMapEither(checkConfirmationModalNeeded)
	);

const planPostUpload = (res: Separated<Error[], Item[]>) =>
	pipe(
		getPosts,
		RTE.map((serverFiles) => new ServerMap(serverFiles)),
		RTE.map(sortItems(res, "post"))
	);

const planAssetUpload = (res: Separated<Error[], Item[]>) =>
	pipe(
		getAssets,
		RTE.map((serverFiles) => new ServerMap(serverFiles)),
		RTE.map(sortItems(res, "asset"))
	);

const buildStats = (uploadPlan: UploadPlan, type: "post" | "asset") => {
	return [
		{
			type,
			name: "skip/md5",
			count: uploadPlan.md5Collision ?? 0,
		},
		{
			type,
			name: "skip/slug",
			count: uploadPlan.slugCollision ?? 0,
		},
		{
			type,
			name: "error/file",
			count: uploadPlan.fileErrors ?? 0,
		},
	];
};

const sortItems =
	(
		{ left: errors, right: items }: Separated<Error[], Item[]>,
		type: "post" | "asset"
	) =>
	(serverMap: ServerMap) => {
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

		return pipe(
			items,
			A.map(updateFileStatus),
			NEA.groupBy((item) => item.status),
			(groups) => ({
				pending: groups[FileStatus.PENDING] ?? [],
				md5Collision: groups[FileStatus.MD5_COLLISION] ?? [],
				slugCollision: groups[FileStatus.SLUG_COLLISION] ?? [],
				toDelete: serverMap.slugsToDelete,
				fileErrors: groups[FileStatus.READ_ERROR] ?? [],
				errors: errors,
				totalCount: items.length,
				slugMap: slugMap,
			})
		);
	};

type CheckContext = {
	serverMap: ServerMap;
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
		if (serverMap.hasSameMd5(item) && item.status === FileStatus.PENDING) {
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
		serverMap.markAsExisting(item);
		return item;
	};

const checkConfirmationModalNeeded = E.fromPredicate(
	({ postPlan, assetPlan }: UploadPlans) =>
		isUploadNeeded(postPlan) || isUploadNeeded(assetPlan),
	() => new Error("No changes to upload")
);

const isUploadNeeded = (plan: UploadPlan) =>
	plan.pending.length > 0 ||
	plan.toDelete.length > 0 ||
	// if there are any file errors or slug collisions, lets show friendly modal
	plan.fileErrors.length > 0 ||
	plan.slugCollision.length > 0;
