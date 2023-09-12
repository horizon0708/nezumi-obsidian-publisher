import { pipe } from "fp-ts/lib/function";
import { TFile } from "obsidian";
import SparkMD5 from "spark-md5";
import { RTE } from "src/shared/fp";
import { cachedRead, readBinary } from "src/shared/obsidian-fp";
import { PFile } from "../shared/types";

export const readMd5 = (pFile: PFile) =>
	pipe(
		pFile.file,
		getFileMd5,
		RTE.map((md5) => ({
			...pFile,
			md5,
		}))
	);

const getFileMd5 = (file: TFile) => {
	if (file.extension === "md") {
		return pipe(cachedRead(file), RTE.map(SparkMD5.hash));
	}
	return pipe(readBinary(file), RTE.map(SparkMD5.ArrayBuffer.hash));
};
