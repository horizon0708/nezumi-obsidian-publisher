import { A, Separated, semigroup } from "src/shared/fp";

export const separatedSemigroup = <E, A>() =>
	semigroup.struct<Separated.Separated<E[], A[]>>({
		left: A.getSemigroup<E>(),
		right: A.getSemigroup<A>(),
	});
