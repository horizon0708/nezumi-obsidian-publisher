import { t } from "src/shared/fp";
import { blogSchema } from "src/shared/network-new/connect";

// blog
const blogClientData = t.type({
	apiKey: t.string,
	endpoint: t.string,
	syncFolder: t.string,
});

export const savedBlogSchema = t.intersection([blogSchema, blogClientData]);

export type SavedBlog = t.TypeOf<typeof savedBlogSchema>;

// config
export const pluginConfigSchema = t.type({
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

export type PluginConfigT = t.TypeOf<typeof pluginConfigSchema>;

// combined data
export const pluginData = t.type({
	blogs: t.array(savedBlogSchema),
});

export type PluginData = t.TypeOf<typeof pluginData>;

export const DEFAULT_CONFIG: PluginConfigT = {
	slugKey: "slug",
	domain: "tuhua.io",
	baseUrl: process.env.DEV
		? `http://localhost:4000/api`
		: `https://tuhua.io/api`,
	apiKeyHeader: "x-blog-api-Key",
	endpoints: {
		getBlog: "ping",
		getFileList: "files",
		uploadPost: "files",
		uploadAsset: "files",
		deleteFiles: "files",
	},
};
