import { A, E, RT, RTE, Separated, pipe } from "src/shared/fp";
import { PFile } from "./shared/types";
import { Manifest } from "src/commands/push-changes/shared/manifest";
import { TFile } from "obsidian";
import SparkMD5 from "spark-md5";
import { cachedRead, readBinary } from "src/shared/obsidian-fp";
import { Md5CollisionError, SlugCollisionError } from "src/shared/errors";
import { LocalDeps, addLocalContext } from "../../shared/add-local-context";

type Args = {
	manifest: Manifest;
	candidates: {
		left: Error[];
		right: PFile[];
	};
};
type LocalContext = LocalDeps<Manifest>;

export const filterCandidates = ({ candidates, manifest }: Args) => {
	return pipe(
		candidates,
		processManySeq(processAndFilterFile),
		addLocalContext(manifest)
	);
};

// - read md5
const getFileMd5 = (file: TFile) => {
	if (file.extension === "md") {
		return pipe(cachedRead(file), RTE.map(SparkMD5.hash));
	}
	return pipe(readBinary(file), RTE.map(SparkMD5.ArrayBuffer.hash));
};

const readMd5 = (pFile: PFile) =>
	pipe(
		pFile.file,
		getFileMd5,
		RTE.map((md5) => ({
			...pFile,
			md5,
		}))
	);

// Check Slug
type HasSlug = {
	slug: string;
	file: TFile;
};
const checkSlugCollision =
	<T extends HasSlug>(pFile: T) =>
	({ args: manifest }: LocalContext) => {
		const { slug, file } = pFile;
		const post = manifest.getPostBySlug(slug);
		if (post && !!post.path) {
			return E.left(new SlugCollisionError(file, post.path));
		}
		return E.right(pFile);
	};

// register slug - manifest IOs
const registerSlug =
	<T extends PFile>(pFile: T) =>
	({ args: manifest }: LocalContext) =>
	() => {
		const { slug, file } = pFile;
		manifest.registerLocalSlug(slug, file);
	};

// cheek md5
type HasMd5 = {
	md5: string;
} & HasSlug;
const checkMd5Collision =
	<T extends HasMd5>(item: T) =>
	({ args: manifest }: LocalContext) => {
		if (manifest.hasSameMd5(item)) {
			return E.left(new Md5CollisionError(item.file));
		}
		return E.right(item);
	};

// process many
const processAndFilterFile = (pFile: PFile) =>
	pipe(
		readMd5(pFile),
		RTE.flatMapReaderEither(checkSlugCollision),
		RTE.tapReaderIO(registerSlug),
		RTE.flatMapReaderEither(checkMd5Collision)
	);

const flatten =
	<A, B>(a: Separated.Separated<Error[], A[]>) =>
	(b: Separated.Separated<Error[], B[]>) => ({
		left: [...a.left, ...b.left],
		right: b.right,
	});

type FileProcessor<R, A, T extends PFile> = (
	t: T
) => RTE.ReaderTaskEither<R, Error, A>;
const processManySeq =
	<R, A, T extends PFile>(sorter: FileProcessor<R, A, T>) =>
	(result: Separated.Separated<Error[], T[]>) => {
		return pipe(
			result.right,
			A.map(sorter),
			A.sequence(RT.ApplicativeSeq),
			RT.map(A.separate),
			RT.map(flatten(result)),
			RTE.rightReaderTask
		);
	};
