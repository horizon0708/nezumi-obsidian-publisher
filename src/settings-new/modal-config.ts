import { FormField } from "src/settings-new/edit-modal";
import { buildPluginConfig } from "src/plugin-config";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import * as A from "fp-ts/Array";
import { App, TFolder } from "obsidian";
import { SavedBlog } from "src/io/plugin-data";

// If you update the order, update `buildUpdateFormFields` below!
export const blogModalFormFields: FormField[] = [
	{
		key: "apiKey",
		label: "API key",
		description: "The API key for your blog",
		value: "",
		initialValue: "",
		isHidden: false,
		showRestoreButton: false,
	},
	{
		key: "syncFolder",
		label: "Folder to publish",
		description: "Set to '/' to publish the entire vault (not recommended)",
		value: "",
		initialValue: "",
		isHidden: false,
		showRestoreButton: false,
	},
	{
		key: "alias",
		label: "Alias",
		description: "Optional alias for the connection",
		value: "",
		initialValue: "",
		isHidden: false,
		showRestoreButton: false,
	},
	{
		key: "endpoint",
		label: "API endpoint",
		value: buildPluginConfig().baseUrl,
		initialValue: buildPluginConfig().baseUrl,
		isHidden: true,
		showRestoreButton: true,
	},
];

export const buildUpdateFormFields = (blog: SavedBlog) =>
	A.zipWith(
		[
			{ value: blog.apiKey },
			{ value: blog.syncFolder },
			{ value: blog.name },
			{ value: blog.endpoint },
		],
		blogModalFormFields,
		(f1, f2) => ({ ...f2, ...f1 })
	);

export const blogModalFormSchema = ({ app }: { app: App }) =>
	t.type({
		apiKey: withMessage(minLength, () => "API key cannot be empty"),
		syncFolder: withMessage(
			validPath(app),
			() => "Sync folder must be a valid folder"
		),
		alias: t.string,
		// TODO: regex valid url
		endpoint: withMessage(minLength, () => "Endpoint cannot be empty"),
	});

interface MinimumLength {
	readonly stringMinLength: unique symbol; // use `unique symbol` here to ensure uniqueness across modules / packages
}
const minLength = t.brand(
	t.string, // a codec representing the type to be refined
	(n): n is t.Branded<string, MinimumLength> => n.length > 0, // a custom type guard using the build-in helper `Branded`
	"stringMinLength" // the name must match the readonly field in the brand
);

interface ValidPath {
	readonly validPath: unique symbol;
}
const validPath = (app: App) =>
	t.brand(
		t.string,
		(n): n is t.Branded<string, ValidPath> =>
			app.vault.getAbstractFileByPath(n) instanceof TFolder,
		"validPath"
	);
