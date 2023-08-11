import * as O from "fp-ts/Option";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import { ServerFile } from "src/io/network";
type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

export type ManifestState = ReturnType<typeof emptyState>;

export const emptyState = () => ({
	serverPosts: new Map<string, ServerFileState>(),
	localSlugs: new Map<string, string>(),
	embeddedAssets: new Set<string>(),
});

export const newProcessingState = (files: ServerFile[]) => {
	const serverPosts = new Map<string, ServerFileState>();
	files.forEach(({ path, md5 }) => {
		if (path) {
			serverPosts.set(path, { md5, hasLocalCopy: false });
		}
	});
	return {
		...emptyState(),
		serverPosts,
	};
};

const liftSRTEModify =
	<T>(fn: (s: ManifestState, arg: T) => ManifestState) =>
	(arg: T) =>
		SRTE.modify((s: ManifestState) => fn(s, arg));

const liftSRTEModify2 =
	<T, K>(fn: (s: ManifestState, arg: T, arg2: K) => ManifestState) =>
	(arg: T, arg2: K) =>
		SRTE.modify((s: ManifestState) => fn(s, arg, arg2));

export const registerLocalCopy = (s: ManifestState, path: string) => {
	const sp = s.serverPosts.get(path);
	if (sp) {
		sp.hasLocalCopy = true;
	}
	return s;
};
export const registerLocalCopySRTE = liftSRTEModify(registerLocalCopy);

export const getServerMd5 = (s: ManifestState, path: string) => {
	const sp = s.serverPosts.get(path);
	return O.fromNullable(sp?.md5);
};

export const markLocalCopy = (s: ManifestState, path: string) => {
	const sp = s.serverPosts.get(path);
	if (sp) {
		sp.hasLocalCopy = true;
	}
	return s;
};
export const markLocalCopySRTE = liftSRTEModify(markLocalCopy);

export const registerEmbeddedAssets = (
	s: ManifestState,
	paths: Set<string>
) => {
	paths.forEach((path) => {
		s.embeddedAssets.add(path);
	});
	return s;
};
export const registerEmbeddedAssetsSRTE = liftSRTEModify(
	registerEmbeddedAssets
);

export const getLocalPath = (s: ManifestState, slug: string) => {
	return s.localSlugs.get(slug);
};

export const registerLocalSlug = (
	s: ManifestState,
	slug: string,
	path: string
) => {
	s.localSlugs.set(slug, path);
	return s;
};

export const registerLocalSlugSRTE = liftSRTEModify2(registerLocalSlug);
