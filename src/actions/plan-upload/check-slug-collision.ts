import { pipe } from "fp-ts/lib/function";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import {
	FPState,
	getLocalPath,
	registerLocalSlug,
} from "src/file-processing-state";
import {
	BaseContext,
	BaseItem,
	FileStatus,
	FileType,
	ItemBuilder,
	Post,
} from "../types";

type PostContext = BaseContext & { base: BaseItem };

/**
 * Updates Slug if the file is a post
 * - ignored if the file is an asset
 * - also may update slug in the frontmatter
 *
 * This works but not sure if it is any good.
 * - typing is weird, I have to coerce it.
 */
export const checkSlugCollision: ItemBuilder = (base: BaseItem) => {
	if (!base.file.path.endsWith(".md")) {
		return SRTE.right({ ...base, type: FileType.ASSET });
	}

	return pipe(
		SRTE.asks((deps: BaseContext) => ({ ...deps, base })),
		SRTE.chainTaskEitherKW((deps) =>
			pipe(
				RTE.Do,
				RTE.apS("slugFromFm", getSlugFromFm),
				RTE.apS("defaultSlug", getDefaultSlug),
				RTE.bind("slug", ({ slugFromFm, defaultSlug }) =>
					RTE.of(getSlug(slugFromFm, defaultSlug))
				),
				RTE.tap(({ slug }) => maybeUpdateSlugInFrontmatter(slug)),
				RTE.map(({ slug }) => ({
					...deps.base,
					type: FileType.POST as const,
					slug: slug,
					conflictsWith: O.none,
				}))
			)(deps)
		),
		//  stateful functions, so order matters here!
		SRTE.chain((e) => checkForSlugCollision(e)),
		// I don't understand why `tap` widens to Post | Asset here
		SRTE.tap((e: Post) => callRegisterLocalSlug(e))
	);
};

const getSlugFromFm = (d: PostContext) =>
	pipe(
		d.app.metadataCache.getFileCache(d.base.file)?.frontmatter?.[
			d.pluginConfig.slugKey
		] as string,
		O.fromNullable,
		O.fold(
			() => TE.right(O.none),
			(slug) => TE.right(O.some(slug))
		)
	);

const getDefaultSlug = (d: PostContext) =>
	TE.of(d.base.file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-"));

const getSlug = (slugFromFm: O.Option<string>, defaultSlug: string) => {
	if (O.isSome(slugFromFm)) {
		return slugFromFm.value;
	}
	return defaultSlug;
};

const maybeUpdateSlugInFrontmatter = (slug: string) =>
	RTE.asksReaderTaskEither((deps: PostContext) =>
		pipe(
			TE.tryCatch(
				() =>
					deps.app.fileManager.processFrontMatter(
						deps.base.file,
						(frontmatter) => {
							frontmatter[deps.pluginConfig.slugKey] = slug;
						}
					),
				() => ({
					status: FileStatus.SLUG_UPDATE_ERROR,
					file: deps.base.file,
					message: O.none,
				})
			),
			RTE.fromTaskEither
		)
	);

const checkForSlugCollision = <R, E>(base: Post) =>
	pipe(
		SRTE.get<FPState, R, E>(),
		SRTE.map((s) => {
			const slug = getLocalPath(s, base.slug);
			return {
				...base,
				status: FileStatus.SLUG_COLLISION,
				conflictsWith: O.some(slug),
			};
		})
	);

const callRegisterLocalSlug = (post: Post) =>
	SRTE.modify((s: FPState) => {
		return registerLocalSlug(s, post.slug, post.serverPath);
	});
