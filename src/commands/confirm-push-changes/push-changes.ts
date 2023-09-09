import { pipe } from "fp-ts/lib/function";
import { RTE, RT, A, O, r, R } from "src/shared/fp";
import { deletePosts, deleteAssets } from "src/shared/network-new";
import { showNotice } from "src/shared/obsidian-fp";
import { showErrorNoticeRTE } from "src/shared/obsidian-fp/notifications";
import { UploadPlan, UploadPlans } from "./plan-upload";
import { SlugMap } from "./plan-upload/slug-map";
import { uploadItems } from "./upload-items";
import { newUploadSession } from "src/shared/plugin-data/upload-session-2";
import { saveUploadSession } from "src/shared/plugin-data";

export const pushChanges = ({ postPlan, assetPlan }: UploadPlans) => {
	return pipe(
		R.Do,
		R.apSW("session", newUploadSession()),
		RTE.rightReader,
		RTE.tap(() => pushDeletes(postPlan, deletePosts)),
		RTE.tap(() => pushDeletes(assetPlan, deleteAssets)),
		RTE.let("combinedSlugMap", () =>
			postPlan.slugMap.merge(assetPlan.slugMap)
		),
		RTE.bindW("postResult", ({ session, combinedSlugMap }) =>
			pushUploads(postPlan, session.id, combinedSlugMap)
		),
		RTE.bindW("assetResult", ({ session, combinedSlugMap }) =>
			pushUploads(assetPlan, session.id, combinedSlugMap)
		),
		RTE.tapError(showErrorNoticeRTE),
		// TODO: add stats for uploadSession
		RTE.tapIO(() => () => showNotice("[Tuhua Publisher] Upload complete!")),
		RTE.tap(({ session }) => saveUploadSession(session)),
		RTE.fold(
			() => RT.of(undefined as void),
			() => RT.of(undefined as void)
		)
	);
};

type DeleteRTE = typeof deletePosts;

const pushDeletes = (plan: UploadPlan, deleteRTE: DeleteRTE) =>
	pipe({ slugs: plan.toDelete }, deleteRTE);

const pushUploads = (
	plan: UploadPlan,
	sessionId: string,
	combinedSlugMap: SlugMap
) => {
	return pipe(
		plan.pending,
		A.map((x) => ({
			...x,
			sessionId: O.some(sessionId),
			links: convertPathToSlug(x.links, combinedSlugMap),
		})),
		uploadItems,
		RTE.rightReaderTask
	);
};

const convertPathToSlug = (links: Record<string, string>, slugMap: SlugMap) => {
	const maybeTuples = Object.entries(links).map(([link, path]) => {
		const slug = slugMap.getByPath(path);
		if (!slug) {
			return O.none;
		}
		return O.some([link, slug] as [string, string]);
	});

	return pipe(maybeTuples, A.compact, r.fromEntries);
};
