import { flow } from "fp-ts/lib/function";
import { BaseFile, buildBaseFile } from "./base-file";
import SRTE from "fp-ts/StateReaderTaskEither";
import { checkSlugCollision } from "./check-slug-collision";
import { checkMd5Collision } from "./check-md5";
import { FileProcessingStateImpl } from "src/file-processing-state";

const registerEmbeddedAssets = (post: BaseFile) =>
	SRTE.modify((s: FileProcessingStateImpl) => {
		return s.registerEmbeddedAssets(post.embeddedAssets);
	});

const markLocalCopy = (post: BaseFile) =>
	SRTE.modify((s: FileProcessingStateImpl) => {
		return s.markLocalCopy(post.serverPath);
	});

const buildFile = flow(
	buildBaseFile,
	SRTE.fromReader,
	SRTE.tap(registerEmbeddedAssets),
	SRTE.tap(markLocalCopy),
	SRTE.chain(checkSlugCollision),
	SRTE.chain(checkMd5Collision)
);
