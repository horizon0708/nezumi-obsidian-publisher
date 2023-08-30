import { t } from "../fp";

export type PluginConfigT = t.TypeOf<typeof pluginConfigSchema>;

const pluginConfigSchema = t.type({
	slugKey: t.string,
	baseUrl: t.string,
	domain: t.string,
	apiKeyHeader: t.string,
	endpoint: t.type({
		getBlog: t.string,
		getFileList: t.string,
		uploadPost: t.string,
		uploadAsset: t.string,
		deleteFiles: t.string,
	}),
	formDataDelimiter: t.string,
});
