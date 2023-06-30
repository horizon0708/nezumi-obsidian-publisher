import Logger from "js-logger";
import { ServerFile } from "./types";

type ServerFileState = { md5: string; hasLocalCopy: boolean };
type LocalFileState = {
	uploaded?: boolean;
	code: string;
	message?: string;
	md5?: string;
};
type PathWithoutSyncFolder = string;
type PathString = string;

export class Manifest {
	private serverFiles: Map<PathWithoutSyncFolder, ServerFileState> = new Map<
		string,
		ServerFileState
	>();
	private localFiles: Map<PathString, LocalFileState> = new Map<
		string,
		LocalFileState
	>();
	private localSlugs: Map<string, PathString> = new Map<string, PathString>();
	private embeddedAssets: Set<PathString> = new Set<PathString>();
	private syncFolder: string;

	constructor(files: ServerFile[], syncFolder: string) {
		this.syncFolder = syncFolder;
		files.forEach(({ path, md5 }) => {
			this.serverFiles.set(path, { md5, hasLocalCopy: false });
		});
		Logger.debug("Manifest.constructor", this.serverFiles);
	}

	getServerMd5(path: PathString): string | null {
		const key = this.stripSyncFolder(path);
		const value = this.serverFiles.get(key);

		if (!value) {
			return null;
		}

		value.hasLocalCopy = true;

		return value.md5;
	}

	addSlugAndCheckCollision(path: PathString, slug: string) {
		const duplicatePath = this.localSlugs.get(slug);
		if (!duplicatePath) {
			this.localSlugs.set(slug, path);
		}
		return duplicatePath;
	}

	addAssetPath(path: PathString) {
		this.embeddedAssets.add(path);
	}

	stripSyncFolder(path: PathString): PathWithoutSyncFolder {
		if (this.syncFolder !== "/") {
			return path.slice(this.syncFolder.length + 1);
		}
		return path;
	}

	get getFilesToDelete() {
		const toDelete: PathString[] = [];
		this.serverFiles.forEach((value, key, map) => {
			if (!value.hasLocalCopy) {
				toDelete.push(key);
			}
		});

		Logger.debug("getFilesToDelete", this.serverFiles);
		return toDelete;
	}

	get assetsToUpload() {
		return Array.from(this.embeddedAssets);
	}

	skipped(path: PathString, message: string) {
		this.localFiles.set(path, { code: "UPLOAD_SKIPPED", message });
	}

	skippedDueToCollsion(path: PathString, message: string) {
		this.localFiles.set(path, {
			code: "UPLOAD_SKIPPED/COLLISION",
			message,
		});
	}

	failed(path: PathString, message: string) {
		this.localFiles.set(path, { code: "UPLOAD_FAILED", message });
	}

	succeeded(path: PathString) {
		this.localFiles.set(path, { code: "UPLOAD_SUCCESS", uploaded: true });
	}

	get uploadResult() {
		const result: string[][] = [];
		this.localFiles.forEach((value, key, map) => {
			result.push([key, value.code, value.message]);
		});
		return result;
	}
}
