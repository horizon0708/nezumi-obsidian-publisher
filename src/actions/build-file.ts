import { flow } from "fp-ts/lib/function";
import { buildBaseFile } from "./base-file";
import SRTE from "fp-ts/StateReaderTaskEither";
import { checkSlugCollision } from "./check-slug-collision";
import { checkMd5Collision } from "./check-md5";
import { FileProcessingStateImpl } from "src/file-processing-state";

const registerEmbeddedAssets = (post: { embeddedAssets: Set<string> }) =>
	SRTE.modify((s: FileProcessingStateImpl) => {
		return s.registerEmbeddedAssets(post.embeddedAssets);
	});

const markLocalCopy = (post: { serverPath: string }) =>
	SRTE.modify((s: FileProcessingStateImpl) => {
		return s.markLocalCopy(post.serverPath);
	});

const buildFile = flow(
	buildBaseFile,
	SRTE.fromReaderTaskEither,
	SRTE.tap((item) => registerEmbeddedAssets(item)),
	SRTE.tap((item) => markLocalCopy(item)),
	SRTE.chain(checkSlugCollision),
	SRTE.chain(checkMd5Collision)
);
