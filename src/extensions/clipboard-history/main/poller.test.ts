import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  ClipboardPoller,
  type ClipboardItemLike,
  type ClipboardReader,
  type ImageSource,
} from "./poller.ts";

class FakeClipboard implements ClipboardReader {
  text = "";
  imageBuffer: Buffer | null = null;
  /** Set to simulate a Finder/Explorer-style file copy's `text/uri-list`. */
  fileUriList: string | null = null;
  /** How many times `readText()` ran — proves a `changeSignal` short-circuit actually skipped the real read. */
  readCalls = 0;

  async readText(): Promise<string> {
    this.readCalls += 1;
    return this.text;
  }

  async read(): Promise<ClipboardItemLike[]> {
    const items: ClipboardItemLike[] = [];
    if (this.fileUriList != null) {
      const list = this.fileUriList;
      items.push({ types: ["text/uri-list"], getType: async () => list });
    }
    if (this.text) {
      items.push({ types: ["text/plain"], getType: async () => this.text });
    }
    if (this.imageBuffer) {
      const buffer = this.imageBuffer;
      items.push({
        types: ["image/png"],
        getType: async () => new Blob([buffer], { type: "image/png" }),
      });
    }
    return items;
  }
}

function setup(
  files: Record<string, Buffer> = {},
  changeSignal?: () => number,
) {
  const clipboard = new FakeClipboard();
  const texts: string[] = [];
  const images: Buffer[] = [];
  const sources: (ImageSource | undefined)[] = [];
  const poller = new ClipboardPoller(
    clipboard,
    (text) => texts.push(text),
    (png, source) => {
      images.push(png);
      sources.push(source);
    },
    750,
    async (path) => {
      const buffer = files[path];
      if (!buffer) throw new Error(`no such file: ${path}`);
      return buffer;
    },
    changeSignal,
  );
  return { clipboard, texts, images, sources, poller };
}

test("start() does not record the clipboard's current contents", async () => {
  const { clipboard, texts, poller } = setup();
  clipboard.text = "already there";
  await poller.start();
  await poller.tick();
  assert.deepEqual(texts, []);
  poller.stop();
});

test("a text change fires onText once", async () => {
  const { clipboard, texts, poller } = setup();
  await poller.start();
  clipboard.text = "copied!";
  await poller.tick();
  await poller.tick();
  assert.deepEqual(texts, ["copied!"]);
  poller.stop();
});

test("an unchanged clipboard fires nothing", async () => {
  const { clipboard, texts, images, poller } = setup();
  clipboard.text = "steady";
  await poller.start();
  await poller.tick();
  await poller.tick();
  assert.deepEqual(texts, []);
  assert.deepEqual(images, []);
  poller.stop();
});

test("writeExclusive() resyncs so the next tick doesn't re-record the write", async () => {
  const { clipboard, texts, poller } = setup();
  await poller.start();
  await poller.writeExclusive(async () => {
    clipboard.text = "pasted back";
  });
  await poller.tick();
  assert.deepEqual(texts, []);
  poller.stop();
});

test("an image-format transition fires onImage once", async () => {
  const { clipboard, images, sources, poller } = setup();
  await poller.start();
  clipboard.imageBuffer = Buffer.from("fake-png");
  await poller.tick();
  await poller.tick();
  assert.equal(images.length, 1);
  assert.equal(images[0].toString(), "fake-png");
  assert.equal(sources[0], undefined); // no file source for an embedded copy
  poller.stop();
});

test("writeExclusive() suppresses the matching image transition", async () => {
  const { clipboard, images, poller } = setup();
  await poller.start();
  await poller.writeExclusive(async () => {
    clipboard.imageBuffer = Buffer.from("fake-png");
  });
  await poller.tick();
  assert.deepEqual(images, []);
  poller.stop();
});

test("text takes priority over an image present at the same time", async () => {
  const { clipboard, texts, images, poller } = setup();
  await poller.start();
  clipboard.text = "text wins";
  clipboard.imageBuffer = Buffer.from("fake-png");
  await poller.tick();
  assert.deepEqual(texts, ["text wins"]);
  assert.deepEqual(images, []);
  poller.stop();
});

test("a file-copy's text/uri-list resolves to the image at that path", async () => {
  const path = "/Users/user/Desktop/Screenshot 2026-09-16 at 1.22.43 AM.png";
  const bytes = Buffer.from("fake-png-bytes");
  const { clipboard, texts, images, sources, poller } = setup({
    [path]: bytes,
  });
  await poller.start();
  clipboard.text = "Screenshot 2026-09-16 at 1.22.43 AM.png"; // Finder's plain-text fallback
  clipboard.fileUriList = pathToFileURL(path).href;
  await poller.tick();
  assert.deepEqual(images, [bytes]);
  assert.deepEqual(sources, [{ path }]);
  assert.deepEqual(texts, []); // not also recorded as the filename
  poller.stop();
});

test("a file-copy pointing at a non-image extension falls back to recording the text", async () => {
  const { clipboard, texts, images, poller } = setup({
    "/Users/user/notes.txt": Buffer.from("irrelevant"),
  });
  await poller.start();
  clipboard.text = "notes.txt";
  clipboard.fileUriList = "file:///Users/user/notes.txt";
  await poller.tick();
  assert.deepEqual(images, []);
  assert.deepEqual(texts, ["notes.txt"]);
  poller.stop();
});

test("a multi-file copy falls back to recording the text, not an image", async () => {
  const { clipboard, texts, images, poller } = setup({
    "/a.png": Buffer.from("a"),
    "/b.png": Buffer.from("b"),
  });
  await poller.start();
  clipboard.text = "2 items";
  clipboard.fileUriList = "file:///a.png\nfile:///b.png";
  await poller.tick();
  assert.deepEqual(images, []);
  assert.deepEqual(texts, ["2 items"]);
  poller.stop();
});

test("a file read failure falls back to recording the text instead of throwing", async () => {
  const { clipboard, texts, images, poller } = setup(); // no files registered
  await poller.start();
  clipboard.text = "missing.png";
  clipboard.fileUriList = "file:///no/such/missing.png";
  await poller.tick();
  assert.deepEqual(images, []);
  assert.deepEqual(texts, ["missing.png"]);
  poller.stop();
});

test("changeSignal() unchanged skips the real read entirely", async () => {
  let signal = 100;
  const { clipboard, texts, poller } = setup({}, () => signal);
  await poller.start();
  const callsAfterStart = clipboard.readCalls;

  clipboard.text = "should not be seen"; // real content changed, but the signal didn't
  await poller.tick();

  assert.deepEqual(texts, []);
  assert.equal(clipboard.readCalls, callsAfterStart); // no real read attempted
  poller.stop();
});

test("changeSignal() moving triggers the real read", async () => {
  let signal = 100;
  const { clipboard, texts, poller } = setup({}, () => signal);
  await poller.start();

  clipboard.text = "copied!";
  signal = 101;
  await poller.tick();

  assert.deepEqual(texts, ["copied!"]);
  poller.stop();
});

test("a throwing changeSignal() falls through to the real read instead of getting stuck", async () => {
  const { clipboard, texts, poller } = setup({}, () => {
    throw new Error("native call failed");
  });
  await poller.start();
  clipboard.text = "still detected";
  await poller.tick();

  assert.deepEqual(texts, ["still detected"]);
  poller.stop();
});

test("writeExclusive() resyncs the changeSignal too", async () => {
  let signal = 100;
  const { clipboard, texts, poller } = setup({}, () => signal);
  await poller.start();

  await poller.writeExclusive(async () => {
    clipboard.text = "pasted back";
    signal = 101; // our own write bumps changeCount too, same as a real NSPasteboard write would
  });
  await poller.tick(); // signal already caught up by the resync inside writeExclusive()

  assert.deepEqual(texts, []);
  poller.stop();
});

test("stop() is safe to call twice and start() can resume afterwards", async () => {
  const { clipboard, texts, poller } = setup();
  await poller.start();
  poller.stop();
  poller.stop(); // idempotent
  clipboard.text = "seen only after restart";
  await poller.start(); // reseeds from the clipboard's current contents
  await poller.tick();
  assert.deepEqual(texts, []);
  poller.stop();
});
