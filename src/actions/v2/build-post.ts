import { pipe } from "fp-ts/lib/function";
import {
	Asset,
	BaseContext,
	BaseItem,
	FileStatus,
	FileType,
	Item,
	Post,
	SRTEBuilder2,
} from "../types";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as O from "fp-ts/Option";
import { getSlug } from "./get-slug";
import {
	ManifestState,
	getLocalPath,
	registerLocalSlugSRTE,
} from "./manifest-state";

/**
 * Adds Post specific fields to the BaseItem.
 * Casts BaseItem to Post | Asset
 */
export const buildPostOrAsset = (baseItem: BaseItem) => {
	if (baseItem.type === FileType.ASSET) {
		return SRTE.of({
			...baseItem,
			type: baseItem.type,
		});
	}

	return pipe(
		getSlug(baseItem.file),
		RTE.chainW((slug) =>
			RTE.of({ ...baseItem, slug, type: FileType.POST as const })
		)
		// SRTE.chain((post) => checkForSlugCollision(post)),
		// SRTE.tap((post) => registerLocalSlugSRTE(post.slug, post.serverPath))
	);
};

const checkForSlugCollision = <R, E>(base: Post) =>
	pipe(
		SRTE.get<ManifestState, R, E>(),
		SRTE.map((s) => {
			const slug = getLocalPath(s, base.slug);
			console.log(base, s, base.slug);
			if (slug) {
				return {
					...base,
					status: FileStatus.SLUG_COLLISION,
					conflictsWith: O.some(slug),
				};
			}
			return base;
		})
	);
