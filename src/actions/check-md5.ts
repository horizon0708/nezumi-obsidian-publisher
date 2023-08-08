import { flow, pipe } from "fp-ts/lib/function";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as O from "fp-ts/Option";
import { BaseContext, BaseFile, FileStatus } from "./base-file";
import { FileProcessingStateImpl } from "src/file-processing-state";

export const checkMd5Collision = (base: BaseFile) =>
	pipe(base, getServerMd5, SRTE.tap(checkForCollision));

const getServerMd5 = (base: BaseFile) =>
	pipe(
		SRTE.get<FileProcessingStateImpl, BaseContext>(),
		SRTE.chain((state) =>
			SRTE.of({
				...base,
				serverMd5: state.getServerMd5(base.serverPath),
			} as BaseFile)
		)
	);

const checkForCollision = (
	base: BaseFile
): SRTE.StateReaderTaskEither<
	FileProcessingStateImpl,
	BaseContext,
	never,
	BaseFile
> => {
	if (
		O.isSome(base.md5) &&
		O.isSome(base.serverMd5) &&
		base.md5.value === base.serverMd5.value
	) {
		return SRTE.of({
			...base,
			status: FileStatus.MD5_COLLISION,
		} as BaseFile);
	}
	return SRTE.of(base);
};
