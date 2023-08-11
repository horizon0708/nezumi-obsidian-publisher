import { pipe } from "fp-ts/lib/function";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as O from "fp-ts/Option";
import { FPState, getServerMd5 } from "src/file-processing-state";
import { BaseContext, FileStatus, Item, SRTEBuilder2 } from "../types";

export const checkMd5Collision = (base: Item): SRTEBuilder2<Item> =>
	pipe(base, callGetServerMd5, SRTE.chain(checkForCollision));

const callGetServerMd5 = (base: Item) =>
	pipe(
		SRTE.get<FPState, BaseContext>(),
		SRTE.chain((state) =>
			SRTE.of({
				...base,
				serverMd5: getServerMd5(state, base.serverPath),
			})
		)
	);

const checkForCollision = (
	base: Item
): SRTE.StateReaderTaskEither<FPState, BaseContext, never, Item> => {
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
