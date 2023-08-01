import * as SRTE from "fp-ts/StateReaderTaskEither";
import { App } from "obsidian";
import { flow, pipe } from "fp-ts/function";

type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

type State = {
	serverPosts: Map<string, ServerFileState>;
	localPosts: Map<string, Record<string, string>>;
	localSlugs: Map<string, string>;
	embeddedAssets: Set<string>;
};

type Deps = {
	app: App;
};

const getFilesSRTE = pipe(
	SRTE.ask<State, Deps>(),
	SRTE.map(({ app }) => {
		return app.vault.getFiles();
	})
);

// const postManifest = (serverFiles: ServerFileState[]) =>
// 	pipe(
// 		SRTE.put({
// 			serverFiles,
// 			localPosts: new Map<string, Record<string, string>>(),
// 			localSlugs: new Map<string, string>(),
// 			embeddedAssets: new Set<string>(),
// 		}),
//         SRTE.
// 	);
