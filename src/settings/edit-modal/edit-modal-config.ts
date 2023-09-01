import { DEFAULT_CONFIG } from "src/shared/plugin-data/plugin-config";
import { ControlProps } from "../edit-modal";
import { SavedBlog } from "src/shared/plugin-data";
import { A, t, withMessage } from "src/shared/fp";
import { App, TFolder } from "obsidian";

// If you update the order, update `buildUpdateFormFields` below!
export const editModalFields: ControlProps[] = [
	{
		key: "apiKey",
		name: "API Key",
		description: "The API key for your blog",
		type: "input",
	},
	{
		key: "syncFolder",
		name: "Folder to publish",
		description: "Set to '/' to publish the entire vault (not recommended)",
		type: "folderSuggestion",
		buttonText: "Select Folder",
	},
	{
		key: "alias",
		name: "Alias",
		description: "Optional alias for the connection",
		type: "input",
	},
];

export const editModalHiddenFields: ControlProps[] = [
	{
		key: "endpoint",
		name: "API endpoint",
		type: "input",
		value: DEFAULT_CONFIG.baseUrl,
		defaultValue: DEFAULT_CONFIG.baseUrl,
		showRestoreButton: true,
	},
];

export const buildUpdateFormFields = (blog: SavedBlog): ControlProps[] =>
	A.zipWith(
		editModalFields,
		[
			{ value: blog.apiKey },
			{ value: blog.syncFolder },
			{ value: blog.name },
		],
		(f1, f2) => ({ ...f1, ...f2 })
	);

export const buildUpdateHiddenFormFields = (blog: SavedBlog): ControlProps[] =>
	A.zipWith(editModalHiddenFields, [{ value: blog.endpoint }], (f1, f2) => ({
		...f1,
		...f2,
	}));

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
