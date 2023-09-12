import { A, RT, RTE, Separated, pipe } from "src/shared/fp";
import { PFile } from "../shared/types";
import { checkSlugCollision } from "./check-slugs";
import { checkMd5Collision } from "./check-md5";
import { readMd5 } from "./read-md5";
import { Manifest } from "src/commands/confirm-push-changes/plan-upload/manifest";

export const filterCandidates = (manifest: Manifest) => {
	const checkSlug = checkSlugCollision(manifest);
	const checkMd5 = checkMd5Collision(manifest);

	const processAndFilterFile = (pFile: PFile) =>
		pipe(
			readMd5(pFile),
			RTE.flatMapEither(checkSlug),
			RTE.flatMapEither(checkMd5)
		);

	return pipe(processManySeq(processAndFilterFile));
};

type FileProcessor<R, A, T extends PFile> = (
	t: T
) => RTE.ReaderTaskEither<R, Error, A>;
const processManySeq =
	<R, A, T extends PFile>(sorter: FileProcessor<R, A, T>) =>
	(result: Separated.Separated<Error[], T[]>) =>
		pipe(
			result.right,
			A.map(sorter),
			A.sequence(RT.ApplicativeSeq),
			RT.map(A.separate),
			RT.map(flatten(result)),
			RTE.rightReaderTask
		);

const flatten =
	<A, B>(a: Separated.Separated<Error[], A[]>) =>
	(b: Separated.Separated<Error[], B[]>) => ({
		left: [...a.left, ...b.left],
		right: b.right,
	});
