import { Setting } from "obsidian";
import { ModalContext } from "../types";
import { RIO } from "../fp";

export const emptyModalContent: () => RIO.ReaderIO<ModalContext, void> =
	() =>
	({ modal }: ModalContext) =>
	() => {
		modal.contentEl.empty();
	};

export const openModal: () => RIO.ReaderIO<ModalContext, void> =
	() =>
	({ modal }) =>
	() => {
		modal.open();
	};

export const closeModal: RIO.ReaderIO<ModalContext, void> =
	({ modal }) =>
	() => {
		modal.close();
	};

export const renderModalHeader =
	(title: string) =>
	({ modal }: ModalContext) =>
	() => {
		const header = modal.contentEl.createDiv();
		header.createEl("h2", { text: title });
	};

export const renderModalSpan =
	(text: string) =>
	({ modal }: ModalContext) =>
	() => {
		modal.contentEl.createSpan({ text });
	};

export const renderModalDiv =
	(cls: string[] = []) =>
	({ modal }: ModalContext) =>
	() => {
		return modal.contentEl.createDiv({ cls });
	};

export const renderModalSetting =
	({ modal }: ModalContext) =>
	() => {
		return new Setting(modal.contentEl);
	};
