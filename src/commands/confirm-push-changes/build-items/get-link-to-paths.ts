import { pipe } from "fp-ts/lib/function";
import { TFile, CachedMetadata } from "obsidian";
import { RE, A, R, O, r } from "src/shared/fp";
import { resolveLink, getFileCache } from "src/shared/obsidian-fp";

/**
 * a record containing internal links => full paths
 * e.g.
 * Internal Links => "Test Blog/Directory/Internal Links.md"
 */
export const getLinksToPaths = (file: TFile) =>
	pipe(
		getFileCache(file),
		RE.map(gatherLinks),
		RE.flatMapReader((links) =>
			pipe(
				links,
				A.map(linkToPath(file)),
				A.sequence(R.Applicative),
				R.map(A.compact),
				R.map((tuples) =>
					pipe(tuples, (e) => Array.from(e), r.fromEntries)
				)
			)
		)
	);

const linkToPath = (origin: TFile) => (link: string) =>
	pipe(
		resolveLink(link, origin.path),
		RE.map((e) => [link, e.path] as [string, string]),
		RE.fold(
			() => R.of(O.none),
			(e) => R.of(O.some(e))
		)
	);

const gatherLinks = ({ links, embeds }: CachedMetadata) => {
	return (links ?? []).concat(embeds ?? []).map((x) => x.link);
};
