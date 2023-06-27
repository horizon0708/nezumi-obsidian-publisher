const DOMAIN = "tuhua.io";

export const pluginConfig = {
	name: "Nezumi",
	slugKey: "nezumi_slug",
	domain: DOMAIN,
	baseUrl: `https://${DOMAIN}/api`,
	apiKeyHeader: "x-blog-api-Key",
	endpoints: {
		getBlog: "ping",
		getFileList: "files",
		uploadPost: "files",
		uploadAsset: "files",
		deleteFiles: "files",
	},
	formDataBoundaryString: "NezumiBoundary",
};
