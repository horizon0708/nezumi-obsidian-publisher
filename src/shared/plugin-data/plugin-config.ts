import { t } from "../fp";

export type PluginConfigT = t.TypeOf<typeof pluginConfigSchema>;

const pluginConfigSchema = t.type({
	slugKey: t.string,
	baseUrl: t.string,
	domain: t.string,
	apiKeyHeader: t.string,
	endpoints: t.type({
		getBlog: t.string,
		getFileList: t.string,
		uploadPost: t.string,
		uploadAsset: t.string,
		deleteFiles: t.string,
	}),
});

export const DEFAULT_CONFIG: PluginConfigT = {
	slugKey: "nezumi_slug",
	domain: "tuhua.io",
	baseUrl: `http://localhost:4000/api`,
	// baseUrl: `https://${DOMAIN}/api`,
	apiKeyHeader: "x-blog-api-Key",
	endpoints: {
		getBlog: "ping",
		getFileList: "files",
		uploadPost: "files",
		uploadAsset: "files",
		deleteFiles: "files",
	},
};
