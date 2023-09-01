import { showNotice } from "src/shared/obsidian-fp";
import { RTE } from "../fp";

export const showErrorNoticeIO = (e: Error) => () => showNotice(e.message);
export const showErrorNoticeRTE = RTE.fromIOK(showErrorNoticeIO);
