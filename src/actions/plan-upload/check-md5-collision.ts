import { flow, pipe } from "fp-ts/lib/function";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as O from "fp-ts/Option";
import { FileProcessingStateImpl } from "src/file-processing-state";
import { BaseContext, FileStatus, Item } from "./types";

export const checkMd5Collision = (base: Item) =>
	pipe(base, getServerMd5, SRTE.tap(checkForCollision));

const getServerMd5 = (base: Item) =>
	pipe(
		SRTE.get<FileProcessingStateImpl, BaseContext>(),
		SRTE.chain((state) =>
			SRTE.of({
				...base,
				serverMd5: state.getServerMd5(base.serverPath),
			})
		)
	);

const checkForCollision = (
	base: Item
): SRTE.StateReaderTaskEither<
	FileProcessingStateImpl,
	BaseContext,
	never,
	Item
> => {
	if (
		base.md5 &&
		O.isSome(base.serverMd5) &&
		base.md5 === base.serverMd5.value
	) {
		return SRTE.of({
			...base,
			status: FileStatus.MD5_COLLISION,
		});
	}
	return SRTE.of(base);
};
