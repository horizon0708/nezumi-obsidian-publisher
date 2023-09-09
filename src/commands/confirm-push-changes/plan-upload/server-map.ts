import { ServerFile } from "src/shared/network";

type slugAndMd5 = {
	slug: string;
	md5: string;
};

export class ServerMap {
	serverMap: Map<string, string>;

	constructor(serverFiles: ServerFile[]) {
		this.serverMap = new Map();
		serverFiles.forEach(({ slug, md5 }) => {
			if (slug) {
				this.serverMap.set(slug, md5);
			}
		});
	}

	hasSameMd5({ slug, md5 }: slugAndMd5) {
		const serverMd5 = this.serverMap.get(slug);
		return serverMd5 && serverMd5 === md5;
	}

	markAsExisting({ slug }: slugAndMd5) {
		if (this.serverMap.has(slug)) {
			this.serverMap.delete(slug);
		}
	}

	get slugsToDelete() {
		return Array.from(this.serverMap.keys());
	}
}
