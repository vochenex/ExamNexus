import { isNativeApp } from "./platform";

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Ask the user where to save the file (share / save picker on mobile & desktop).
 * Returns { ok, shared } — shared=true when a system destination picker was used.
 */
export async function downloadBlob(filename, blob) {
  if (!blob) return { ok: false, shared: false };

  const mime = blob.type || "application/octet-stream";

  // Desktop Chromium: real "Save as" location picker.
  if (typeof window !== "undefined" && window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "ExamNexus export",
            accept: { [mime]: [`.${filename.split(".").pop() || "bin"}`] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, shared: true };
    } catch (err) {
      if (err?.name === "AbortError") return { ok: true, shared: true };
      // Fall through to other methods.
    }
  }

  // Native app: write to cache, then open the OS share sheet (Files / Drive / etc.).
  if (isNativeApp()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const base64 = await blobToBase64(blob);
      const written = await Filesystem.writeFile({
        path: `exports/${filename}`,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
      const uri = written?.uri;
      if (uri) {
        await Share.share({
          title: filename,
          text: `ExamNexus export: ${filename}`,
          url: uri,
          dialogTitle: "Save export to…",
        });
        return { ok: true, shared: true };
      }
    } catch (err) {
      if (err?.message?.includes("share canceled") || err?.message?.includes("abort")) {
        return { ok: true, shared: true };
      }
      console.warn("Native share export failed, falling back:", err);
    }
  }

  // Web Share API with files (supported browsers / some WebViews).
  try {
    const file = new File([blob], filename, { type: mime });
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
        text: `Save ExamNexus export: ${filename}`,
      });
      return { ok: true, shared: true };
    }
  } catch (err) {
    if (err?.name === "AbortError") return { ok: true, shared: true };
  }

  // Last resort: browser download attribute.
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return { ok: true, shared: false };
}

export async function downloadCsv(filename, rows, columns) {
  if (!rows?.length) return { ok: false, shared: false };

  const headers = columns.map((col) => col.label);
  const keys = columns.map((col) => col.key);

  const escapeCell = (value) => {
    const text = value == null ? "" : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [
    "\uFEFF" + headers.map(escapeCell).join(","),
    ...rows.map((row) => keys.map((key) => escapeCell(row[key])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  return downloadBlob(filename, blob);
}

export async function downloadHtml(filename, html) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  return downloadBlob(filename, blob);
}

export async function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  return downloadBlob(filename, blob);
}
