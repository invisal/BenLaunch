import { ipcRenderer } from "electron";
import { TEXT_FROM_IMAGE_CHANNELS } from "../shared/types";
import type {
  EngineInfo,
  ExportFormat,
  ExportOptions,
  ExportResult,
  Recognition,
  RecognizeRequest,
  RecognizeResult,
  TextExportFormat,
} from "../shared/types";

/** `window.api.textFromImage` — the Read Text screens' bridge to main. */
export const textFromImageApi = {
  /** Which OCR backend this machine has, and what it can read. Cached in main. */
  engine: (): Promise<EngineInfo> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.engine),

  list: (): Promise<Recognition[]> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.list),

  get: (id: string): Promise<Recognition | null> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.get, id),

  /** Recognize an image. Resolves with a failure rather than rejecting — see
   *  `TextFromImageExtension.recognizeFrom`. */
  recognize: (request: RecognizeRequest): Promise<RecognizeResult> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.recognize, request),

  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.delete, id),

  /** Drop every unpinned recognition. */
  clear: (): Promise<void> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.clear),

  /** Resolves `false` when the pin limit is reached. */
  setPinned: (id: string, pinned: boolean): Promise<boolean> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.setPinned, id, pinned),

  /** Copy the recognition as text / JSON / CSV — the same bytes the matching
   *  file export writes. Resolves `false` for an unknown id. */
  copyAs: (
    id: string,
    format: TextExportFormat,
    options: { table: boolean; includeConfidence: boolean },
  ): Promise<boolean> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.copyText, id, format, options),

  /** The default destination the export form starts on. */
  suggestPath: (id: string, format: ExportFormat): Promise<string> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.suggestPath, id, format),

  /** The Save-As picker. Resolves `null` when dismissed. */
  chooseExportPath: (
    id: string,
    format: ExportFormat,
  ): Promise<string | null> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.chooseExportPath, id, format),

  /** Write the file. Resolves with a failure rather than rejecting. */
  exportAs: (id: string, options: ExportOptions): Promise<ExportResult> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.exportAs, id, options),

  /** Show a just-written file in Explorer / Finder. */
  reveal: (path: string): Promise<void> =>
    ipcRenderer.invoke(TEXT_FROM_IMAGE_CHANNELS.revealExport, path),
};
