import * as RTE from "fp-ts/ReaderTaskEither";
import { showNotice } from "src/shared/obsidian-fp";

export const showErrorNoticeIO = (e: Error) => () => showNotice(e.message);
export const showErrorNoticeRTE = RTE.fromIOK(showErrorNoticeIO);
