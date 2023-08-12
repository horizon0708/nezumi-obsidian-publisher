import { TFile } from "obsidian";

export class FileError extends Error {
	path: string;

	constructor(message: string, file: TFile) {
		super(message);
		this.name = "FileError";
		this.path = file.path;
	}
}
