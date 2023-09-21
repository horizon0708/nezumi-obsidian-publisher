import { pipe } from "fp-ts/lib/function";
import { TFile } from "obsidian";
import { R, O } from "src/shared/fp";
import { getFM } from "src/shared/obsidian-fp";
import { PluginConfigContext } from "src/shared/types";

export const getSlug = (file: TFile) => {
	if (file.extension === "md") {
		return pipe(
			getFM(file),
			R.flatMap(maybeGetSlug),
			R.map(O.getOrElse(() => getDefaultSlug(file)))
		);
	}
	return R.of(getAssetSlug(file));
};

const getAssetSlug = (file: TFile) => {
	return file.path;
};

const maybeGetSlug =
	(maybeFm: O.Option<Record<string, any>>) =>
	({ pluginConfig: { slugKey } }: PluginConfigContext) =>
		pipe(
			maybeFm,
			O.flatMap((fm) => O.fromNullable<string>(fm[slugKey]))
		);

const getDefaultSlug = (file: TFile) =>
	file.basename.toLowerCase().replace(/[^a-z0-9]+/, "-");
