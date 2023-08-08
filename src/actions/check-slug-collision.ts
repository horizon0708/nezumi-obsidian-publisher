import { pipe } from "fp-ts/lib/function";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import { BaseContext, BaseFile, FileStatus, Post } from "./base-file";
import { FileProcessingStateImpl } from "src/file-processing-state";

const isPost = (base: BaseFile): base is Post => base.type === "post";

type PostContext = BaseContext & { base: Post };

/**
 * Updates Slug if the file is a post
 * - ignored if the file is an asset
 * - also may update slug in the frontmatter
 */
export const checkSlugCollision = (base: BaseFile) =>
	pipe(
		base,
		SRTE.fromPredicate(isPost, () => base),
		SRTE.chain((post) =>
			SRTE.asks((deps: BaseContext) => ({ ...deps, base: post }))
		),
		SRTE.chainTaskEitherKW((deps) =>
			pipe(
				RTE.Do,
				RTE.apS("slugFromFm", getSlugFromFm),
				RTE.apS("defaultSlug", getDefaultSlug),
				RTE.bind("slug", ({ slugFromFm, defaultSlug }) =>
					RTE.of(getSlug(slugFromFm, defaultSlug))
				),
				RTE.tap(({ slug }) => maybeUpdateSlugInFrontmatter(slug)),
				RTE.map(({ slug }) => ({ ...deps.base, slug: O.some(slug) })),
				RTE.orElse(() =>
					RTE.of({
						...deps.base,
						status: FileStatus.SLUG_UPDATE_ERROR,
					})
				)
			)(deps)
		),
		//  stateful functions, so order matters here!
		SRTE.tap(checkForSlugCollision),
		SRTE.tap(registerLocalSlug)
	);

const getSlugFromFm = (d: PostContext) =>
	pipe(
		d.app.metadataCache.getFileCache(d.base.file)?.frontmatter?.[
			d.pluginConfig.slugKey
		],
		O.fromNullable<string>,
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
				() => deps.base
			),
			RTE.fromTaskEither
		)
	);

const checkForSlugCollision = <R>(base: BaseFile) =>
	pipe(
		SRTE.get<FileProcessingStateImpl, R, BaseFile>(),
		SRTE.chain((s) => {
			if (O.isNone(base.slug)) {
				return SRTE.right(base);
			}
			const slug = s.getLocalPath(base.slug.value);
			return SRTE.left({
				...base,
				status: FileStatus.SLUG_COLLISION,
				conflictsWith: O.some(slug),
			});
		})
	);

const registerLocalSlug = (post: BaseFile) =>
	SRTE.modify((s: FileProcessingStateImpl) => {
		if (O.isNone(post.slug)) {
			return s;
		}
		return s.registerLocalSlug(post.slug.value, post.serverPath);
	});
