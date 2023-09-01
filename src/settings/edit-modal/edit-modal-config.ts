import { DEFAULT_CONFIG } from "src/shared/plugin-data/plugin-config";
import { ControlProps } from "../edit-modal";
import { SavedBlog } from "src/shared/plugin-data";
import { A } from "src/shared/fp";

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
