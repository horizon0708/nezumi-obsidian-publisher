import { App, TFile } from "obsidian";
import { Blog, FileUploadState } from "./types";
import SparkMD5 from "spark-md5";
import { uploadAssetDe } from "./server-client";

type AssetParams = {
	blog: Blog;
	file: TFile;
	app: App;
	serverMd5?: string;
};

export class Asset {
	private file: TFile;
	private blog: Blog;
	private app: App;
	private serverMd5?: string;
	status: FileUploadState = "pending";
	message?: string;

	constructor({ file, blog, app, serverMd5 }: AssetParams) {
		this.file = file;
		this.blog = blog;
		this.app = app;
		this.serverMd5 = serverMd5;
	}

	upload = async () => {
		try {
			const { apiKey, endpoint } = this.blog;
			const content = await this.app.vault.readBinary(this.file);
			const md5 = SparkMD5.ArrayBuffer.hash(content);
			if (this.serverMd5 && this.serverMd5 === md5) {
				this.setStatus("skipped", "MD5 matches");
				return;
			}
			const res = await uploadAssetDe({
				path: this.file.path,
				apiKey,
				endpoint,
				md5,
				type: "asset",
				content,
			});
			if (!("json" in res)) {
				this.setStatus("failed", res.error);
			}

			this.setStatus("uploaded");
		} catch (e) {
			this.setStatus("failed", e.message);
		}
	};

	setStatus = (status: FileUploadState, message?: string) => {
		this.status = status;
		this.message = message;
	};
}
