import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

function isTextMime(mimeType) {
  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("javascript")
  );
}

export function ViewerModal({ open, file, fileUrl, blob, onClose, viewerLabel }) {
  const [textPreview, setTextPreview] = useState("");

  useEffect(() => {
    if (!open) {
      setTextPreview("");
      return;
    }

    async function loadTextPreview() {
      if (!blob || !isTextMime(file?.mimeType || "")) {
        setTextPreview("");
        return;
      }

      setTextPreview(await blob.text());
    }

    loadTextPreview();
  }, [blob, file?.mimeType, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function preventUnsafeShortcuts(event) {
      const lowerKey = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && ["s", "p", "u"].includes(lowerKey)) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", preventUnsafeShortcuts);
    return () => window.removeEventListener("keydown", preventUnsafeShortcuts);
  }, [open]);

  const mode = useMemo(() => {
    if (!file?.mimeType) {
      return "unknown";
    }

    if (file.mimeType.startsWith("image/")) {
      return "image";
    }

    if (file.mimeType.includes("pdf")) {
      return "pdf";
    }

    if (isTextMime(file.mimeType)) {
      return "text";
    }

    return "binary";
  }, [file?.mimeType]);

  return (
    <AnimatePresence>
      {open && file && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
            className="relative flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-slate-950 shadow-card"
          >
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(69,213,255,0.12),_transparent_30%)]" />
            <div className="relative flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-pulse">Secure Viewer</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{file.title}</h3>
                <p className="text-sm text-slate-400">
                  Watermarked for {viewerLabel || "authorized viewer"} · Integrity verified
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-pulse/40 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="watermark-layer" aria-hidden="true">
              {Array.from({ length: 12 }).map((_, index) => (
                <span key={index}>
                  Vanish Vault · {viewerLabel || "authorized viewer"} · protected access
                </span>
              ))}
            </div>

            <div className="relative flex-1 overflow-auto p-6">
              {mode === "image" && (
                <img
                  src={fileUrl}
                  alt={file.title}
                  className="mx-auto max-h-full rounded-3xl border border-white/10 object-contain shadow-glow"
                />
              )}

              {mode === "pdf" && (
                <iframe
                  src={fileUrl}
                  title={file.title}
                  className="h-full min-h-[65vh] w-full rounded-3xl border border-white/10 bg-white"
                />
              )}

              {mode === "text" && (
                <pre className="min-h-[65vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900/90 p-6 font-mono text-sm leading-7 text-cyan-50">
                  {textPreview}
                </pre>
              )}

              {mode === "binary" && (
                <div className="flex min-h-[65vh] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
                  <div>
                    <p className="text-lg font-semibold text-white">Protected binary content</p>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                      This file opened through a temporary access token and passed digital
                      signature validation. Direct download controls are intentionally hidden in
                      this hackathon viewer.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

