import * as t from "io-ts";

export class NetworkError extends Error {
	status: number;

	constructor(status: number, message?: string) {
		super(message);
		this.status = status;
	}

	override get message() {
		return `${this.status}: ${this.statusMessage}`;
	}

	get statusMessage() {
		switch (this.status) {
			case 415:
			case 400:
				return "Bad request. Please update your plugin.";
			case 401:
				return "API Key is invalid";
			case 403:
				return "Unauthorized";
			case 404:
				return "The endpoint was not found";
			case 413:
				return "The file is too large";
			case 418:
				return "I'm a teapot!";
			case 500:
				return "Internal server error";
			default:
				return "Unhandled network error";
		}
	}
}

export class DecodeError extends Error {
	errors: t.Errors;

	constructor(errors: t.Errors, message?: string) {
		super(message);
		this.errors = errors;
	}
}

export class FileError extends Error {
	path: string;

	constructor(path: string, message?: string) {
		super(message);
		this.path = path;
	}
}
