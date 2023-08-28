import { flip, pipe } from "fp-ts/function";
import { App, TFile } from "obsidian";
import * as O from "fp-ts/Option";
import * as R from "fp-ts/Reader";
import { BaseContext } from "src/shared/types";
import { getFM, buildFmUpdater } from "src/io/obsidian-fp";
import * as RTE from "fp-ts/ReaderTaskEither";

/**
 * Gets the slug set in the frontmatter,
 * or build a default slug from the basename
 *
 * Updates the frontmatter if the slug is not set there.
 */
export const getSlug = (file: TFile) =>
	pipe(
		R.Do,
		R.apS("fmSlug", getExistingFmSlug(file)),
		R.let("slug", ({ fmSlug }) =>
			pipe(
				fmSlug,
				O.getOrElse(() => getDefaultSlug(file))
			)
		),
		RTE.fromReader,
		RTE.tap(({ slug, fmSlug }) => maybeUpdateFmSlug(slug, fmSlug, file)),
		RTE.map(({ slug }) => slug)
	);

const getSlugFromFm =
	(fm: Record<string, any>) =>
	({ pluginConfig }: BaseContext) =>
		pipe(fm[pluginConfig.slugKey], O.fromNullable<string>);

const getExistingFmSlug = (file: TFile) =>
	R.asks((deps: BaseContext) =>
		pipe(getFM(file)(deps), O.chain(flip(getSlugFromFm)(deps)))
	);

const getDefaultSlug = (file: TFile) =>
	file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-");

const maybeUpdateFmSlug = (
	slug: string,
	fmSlug: O.Option<string>,
	file: TFile
) =>
	RTE.asksReaderTaskEitherW(({ pluginConfig }: BaseContext) => {
		if (O.isSome(fmSlug)) {
			return RTE.of(undefined);
		}
		const updateFm = buildFmUpdater((fm: any) => {
			fm[pluginConfig.slugKey] = slug;
		})(file);
		return updateFm;
	});
