import type { IpcMain } from "electron";
import type { TextFromImageExtension } from "../index.ts";
import {
  TEXT_FROM_IMAGE_CHANNELS,
  type ExportFormat,
  type ExportOptions,
  type RecognizeRequest,
  type TextExportFormat,
} from "../shared/types";

/**
 * Wires the Read Text screens' calls to the extension.
 *
 * Nothing here holds logic of its own — the extension owns recognition,
 * storage and export, and these handlers only shuttle. `list`/`get` hand back
 * the store's own accessors, which already return copies, so a renderer can
 * never reach into the stored objects.
 */
export function registerTextFromImageIpc(
  ipc: IpcMain,
  extension: TextFromImageExtension,
): void {
  ipc.handle(TEXT_FROM_IMAGE_CHANNELS.engine, () => extension.engine());

  ipc.handle(TEXT_FROM_IMAGE_CHANNELS.list, () => extension.store.list());

  ipc.handle(
    TEXT_FROM_IMAGE_CHANNELS.get,
    (_event, id: string) => extension.store.get(id) ?? null,
  );

  ipc.handle(
    TEXT_FROM_IMAGE_CHANNELS.recognize,
    (_event, request: RecognizeRequest) => extension.recognizeFrom(request),
  );

  ipc.handle(TEXT_FROM_IMAGE_CHANNELS.delete, (_event, id: string) => {
    extension.store.remove(id);
  });

  ipc.handle(TEXT_FROM_IMAGE_CHANNELS.clear, () => {
    extension.store.clear();
  });

  ipc.handle(
    TEXT_FROM_IMAGE_CHANNELS.setPinned,
    (_event, id: string, pinned: boolean) =>
      extension.store.setPinned(id, pinned),
  );

  ipc.handle(
    TEXT_FROM_IMAGE_CHANNELS.copyText,
    (
      _event,
      id: string,
      format: TextExportFormat,
      options: { table: boolean; includeConfidence: boolean },
    ) => extension.copyAs(id, format, options),
  );

  ipc.handle(
    TEXT_FROM_IMAGE_CHANNELS.suggestPath,
    (_event, id: string, format: ExportFormat) =>
      extension.suggestPath(id, format),
  );

  ipc.handle(
    TEXT_FROM_IMAGE_CHANNELS.chooseExportPath,
    (_event, id: string, format: ExportFormat) =>
      extension.chooseExportPath(id, format),
  );

  ipc.handle(
    TEXT_FROM_IMAGE_CHANNELS.exportAs,
    (_event, id: string, options: ExportOptions) =>
      extension.exportAs(id, options),
  );

  ipc.handle(TEXT_FROM_IMAGE_CHANNELS.revealExport, (_event, path: string) => {
    extension.reveal(path);
  });
}
