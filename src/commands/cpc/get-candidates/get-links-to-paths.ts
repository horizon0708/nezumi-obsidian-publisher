import { TFile, CachedMetadata } from "obsidian";
import { RE, A, R, O, pipe } from "src/shared/fp";
import { resolveLink, getFileCache } from "src/shared/obsidian-fp";

/**
 * a record containing internal links => full paths
 * e.g.
 * Internal Links => "Test Blog/Directory/Internal Links.md"
 */
export const getLinksToPaths = (
	file: TFile,
	getter: (cm: CachedMetadata) => HasLink[]
) =>
	pipe(
		getFileCache(file),
		RE.chainReaderK((cm) =>
			pipe(
				getter(cm),
				buildManyLinkToPath,
				(reader) => reader(file),
				R.map(A.compact)
			)
		)
	);

interface HasLink {
	link: string;
}
const buildManyLinkToPath = (links: HasLink[]) =>
	pipe(
		links,
		A.map(buildLinkToPath),
		A.sequence(R.Applicative),
		R.map(A.sequence(R.Applicative))
	);

const buildLinkToPath =
	({ link }: HasLink) =>
	(file: TFile) =>
		pipe(
			resolveLink(link, file.path),
			RE.map((destFile) => ({ link, path: destFile.path })),
			RE.fold(
				() => R.of(O.none),
				(ltp) => R.of(O.some(ltp))
			)
		);
