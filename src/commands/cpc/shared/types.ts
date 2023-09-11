import { TFile } from "obsidian";

export type LinkToPath = {
	link: string;
	path: string;
};

export enum FType {
	Post = "post",
	Asset = "asset",
}

/**
 * TFile object processed initially
 */
export type PFile = {
	file: TFile;
	type: FType.Post | FType.Asset;
	slug: string;
	links: LinkToPath[];
	embeds: LinkToPath[];
};
export type FileReadE = {
	_tag: "FILE_READ_FAILURE";
	path: string;
	message: string;
};
export type SlugCollisionE = {
	_tag: "SLUG_COLLISION";
	path: string;
	slug: string;
	collisionTarget: string;
	message: string;
};

export type PFileWithMd5 = PFile & {
	md5: string;
};

export type Md5CollisionE = {
	_tag: "MD5_COLLISION";
	path: string;
};

/**
 * Files ready for upload
 */
export type PUpload =
	| ({ type: FType.Post; content: string; sessionId: string } & Omit<
			PFileWithMd5,
			"type"
	  >)
	| ({ type: FType.Asset; content: ArrayBuffer; sessionId: string } & Omit<
			PFileWithMd5,
			"type"
	  >);

export type UploadCancelledE = {
	path: string;
};

export type UploadErrorE = {
	path: string;
};
