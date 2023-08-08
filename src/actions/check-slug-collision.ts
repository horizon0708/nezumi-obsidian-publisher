import { pipe } from "fp-ts/lib/function";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import {
	Asset,
	BaseContext,
	BaseFile,
	FileStatus,
	FileType,
	Item,
	Post,
	SRTEFileBuilder,
} from "./base-file";
import { FileProcessingStateImpl } from "src/file-processing-state";

const isPost = (base: Item): base is Post => base.file.path.endsWith(".md");

type LL = {
	_tag: "LL";
	data: "a";
};

type RR = {
	_tag: "RR";
	data: "b";
};

type EE = LL | RR;

const e = (e: EE) => {
	if (e._tag === "LL") {
		e.data;
	}
};

type PostContext = BaseContext & { base: Item };

/**
 * Updates Slug if the file is a post
 * - ignored if the file is an asset
 * - also may update slug in the frontmatter
 *
 * This works but not sure if it is any good.
 * - typing is weird, I have to coerce it.
 */
export const checkSlugCollision = (
	base: Item
): SRTEFileBuilder<Post | Asset> => {
	if (!isPost(base)) {
		return SRTE.of({ ...base, type: FileType.ASSET as const });
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
		SRTE.tap((e: Post) => registerLocalSlug(e))
	);
};

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
				() => ({
					status: FileStatus.SLUG_UPDATE_ERROR,
					file: deps.base.file,
				})
			),
			RTE.fromTaskEither
		)
	);

const checkForSlugCollision = <R, E>(base: Post) =>
	pipe(
		SRTE.get<FileProcessingStateImpl, R, E>(),
		SRTE.map((s) => {
			const slug = s.getLocalPath(base.slug);
			return {
				...base,
				status: FileStatus.SLUG_COLLISION,
				conflictsWith: O.some(slug),
			};
		})
	);

const registerLocalSlug = (post: Post) =>
	SRTE.modify((s: FileProcessingStateImpl) => {
		return s.registerLocalSlug(post.slug, post.serverPath);
	});
