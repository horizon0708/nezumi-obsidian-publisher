const DOMAIN = "tuhua.io";

export const buildPluginConfig = () => {
	const N = 16;
	const baseFormDataDelimiter = "NezumiBoundary";
	const formDataBoundaryString =
		baseFormDataDelimiter +
		Array(N + 1)
			.join(
				(Math.random().toString(36) + "00000000000000000").slice(2, 18)
			)
			.slice(0, N);

	return {
		name: "Tuhua",
		slugKey: "slug",
		domain: DOMAIN,
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
		baseFormDataDelimiter,
		formDataBoundaryString,
	};
};
