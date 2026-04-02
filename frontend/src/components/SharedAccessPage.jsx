import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { ViewerModal } from "./ViewerModal";

function formatDate(value) {
  if (!value) {
    return "No time rule configured";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SharedAccessPage({ showToast }) {
  const { shareToken } = useParams();
  const [file, setFile] = useState(null);
  const [visitorName, setVisitorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerBlob, setViewerBlob] = useState(null);

  async function loadMetadata() {
    setLoading(true);
    try {
      const response = await api.getSharedMetadata(shareToken);
      setFile(response.file);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetadata();
  }, [shareToken]);

  useEffect(() => {
    return () => {
      if (viewerUrl) {
        URL.revokeObjectURL(viewerUrl);
      }
    };
  }, [viewerUrl]);

  async function handleOpenViewer() {
    setOpening(true);

    try {
      const access = await api.requestSharedAccess(shareToken, visitorName);
      const content = await api.fetchSharedContent(shareToken, access.token);
      const objectUrl = URL.createObjectURL(content.blob);

      if (viewerUrl) {
        URL.revokeObjectURL(viewerUrl);
      }

      setFile(access.file);
      setViewerBlob(content.blob);
      setViewerUrl(objectUrl);
      showToast("Secure shared session opened.");
      await loadMetadata();
    } catch (error) {
      showToast(error.message, "error");
      await loadMetadata();
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] border border-white/10 bg-slate-950/75 p-8 shadow-card"
        >
          <p className="text-xs uppercase tracking-[0.35em] text-pulse">Shared Vault</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-white">
            {loading ? "Loading secure metadata..." : file?.title || "Protected asset"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            This file is protected by a temporary tokenized link. If its key is destroyed by time,
            views, or manual action, access ends permanently.
          </p>

          {file && (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Status</p>
                <p className="mt-3 text-2xl font-semibold text-white">{file.status}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Expiry</p>
                <p className="mt-3 text-lg font-semibold text-white">{formatDate(file.rules?.expiresAt)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Views Left</p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {file.viewsRemaining ?? "Unlimited"}
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              value={visitorName}
              onChange={(event) => setVisitorName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pulse/60"
              placeholder="Optional viewer name for audit logs"
            />
            <button
              type="button"
              onClick={handleOpenViewer}
              disabled={loading || opening || file?.status === "destroyed"}
              className="rounded-2xl bg-gradient-to-r from-pulse to-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:scale-[1.01] disabled:opacity-60"
            >
              {opening ? "Opening..." : "Open protected viewer"}
            </button>
          </div>
        </motion.div>
      </div>

      <ViewerModal
        open={Boolean(file && viewerUrl)}
        file={file}
        fileUrl={viewerUrl}
        blob={viewerBlob}
        viewerLabel={visitorName || "shared visitor"}
        onClose={() => {
          setViewerBlob(null);
          if (viewerUrl) {
            URL.revokeObjectURL(viewerUrl);
            setViewerUrl(null);
          }
        }}
      />
    </>
  );
}

