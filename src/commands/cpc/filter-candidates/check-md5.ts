import { TFile } from "obsidian";
import { E, RTE, pipe } from "src/shared/fp";
import { FileProcessingError } from "src/shared/errors";
import SparkMD5 from "spark-md5";
import { cachedRead, readBinary } from "src/shared/obsidian-fp";
import { Manifest } from "src/commands/cpc/shared/manifest";

interface HasFile {
	file: TFile;
	slug: string;
}

export const checkMd5 =
	(serverMap: Manifest) =>
	<T extends HasFile>(pFile: T) =>
		pipe(
			getFileMd5(pFile.file),
			RTE.map((md5) => ({
				...pFile,
				md5,
			})),
			RTE.flatMapEither(checkMd5Collision(serverMap))
		);

interface HasMd5 {
	file: TFile;
	slug: string;
	md5: string;
}
export const checkMd5Collision =
	(serverMap: Manifest) =>
	<T extends HasMd5>(item: T) => {
		// serverMap.markAsExisting(item);
		if (serverMap.hasSameMd5(item)) {
			return E.left(new FileProcessingError(item.file));
		}
		return E.right(item);
	};

const getFileMd5 = (file: TFile) => {
	if (file.extension === "md") {
		return pipe(cachedRead(file), RTE.map(SparkMD5.hash));
	}
	return pipe(readBinary(file), RTE.map(SparkMD5.ArrayBuffer.hash));
};
