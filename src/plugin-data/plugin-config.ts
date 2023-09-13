const defaultConfig = [
	{
		key: "slugKey",
		value: "slug",
	},
	["slugKey", "slug"],
	["domain", "tuhua.io"],
	[
		"baseUrl",
		process.env.DEV ? `http://localhost:4000/api` : `https://tuhua.io/api`,
	],
	["apiKeyHeader", "x-blog-api-Key"],
];
