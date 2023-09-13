import { pipe } from "fp-ts/lib/function";
import { RTE } from "src/shared/fp";
import { loadData, saveData } from "src/shared/obsidian-fp";
import { PluginData, pluginData } from "./types";

export const loadPluginData = () =>
	pipe(
		loadData,
		RTE.chainEitherKW(pluginData.decode),
		RTE.mapLeft((e) => {
			console.error(e);
			return new Error("plugin data is corrupted");
		})
	);

export const savePluginData = (newData: PluginData) =>
	pipe(
		saveData(newData),
		RTE.mapLeft((e) => {
			console.error(e);
			return new Error("Could not save plugin data");
		})
	);

export const modifyPluginData = (modify: (oldData: PluginData) => PluginData) =>
	pipe(loadPluginData(), RTE.map(modify), RTE.tap(savePluginData));

const defaultData: PluginData = { blogs: [] };
export const maybeInitialisePluginData = (seed: PluginData = defaultData) => {
	return pipe(
		loadData,
		RTE.map((data) => {
			return !data ? seed : data;
		}),
		RTE.chain(saveData)
	);
};

export const clearPluginData = () => pipe(saveData(null));
