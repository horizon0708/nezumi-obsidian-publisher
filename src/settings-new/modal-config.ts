import { FormField } from "src/io/edit-modal";
import { buildPluginConfig } from "src/plugin-config";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";

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

interface MinimumLength {
	readonly stringMinLength: unique symbol; // use `unique symbol` here to ensure uniqueness across modules / packages
}
const minLength = t.brand(
	t.string, // a codec representing the type to be refined
	(n): n is t.Branded<string, MinimumLength> => n.length > 0, // a custom type guard using the build-in helper `Branded`
	"stringMinLength" // the name must match the readonly field in the brand
);

export const blogModalFormSchema = t.type({
	apiKey: withMessage(minLength, () => "API key cannot be empty"),
	syncFolder: withMessage(minLength, () => "Sync folder cannot be empty"),
	alias: t.string,
	endpoint: withMessage(minLength, () => "Endpoint cannot be empty"),
});
