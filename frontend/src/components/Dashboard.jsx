import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api, ApiError } from "../lib/api";
import { ViewerModal } from "./ViewerModal";
import { UpgradeModal } from "./UpgradeModal";

const statsFallback = {
  totalFiles: 0,
  activeFiles: 0,
  destroyedFiles: 0,
  totalViews: 0,
};

const chunkSizeBytes = 5 * 1024 * 1024;

function formatDate(value) {
  if (!value) {
    return "No rule";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 ? 0 : 2)} ${units[exponent]}`;
}

function statusTone(status) {
  if (status === "deleted") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  }

  if (status === "destroyed") {
    return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  }

  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
}

async function uploadChunkWithRetry(token, uploadId, index, blob, retries = 2) {
  try {
    return await api.uploadChunk(token, uploadId, index, blob);
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }

    return uploadChunkWithRetry(token, uploadId, index, blob, retries - 1);
  }
}

export function Dashboard({ token, user, onLogout, onUserUpdate, showToast }) {
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState(statsFallback);
  const [recentLogs, setRecentLogs] = useState([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState([]);
  const [usage, setUsage] = useState(null);
  const [plan, setPlan] = useState(null);
  const [billing, setBilling] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [upgradePlan, setUpgradePlan] = useState(null);
  const [upgrading, setUpgrading] = useState(false);
  const [activeFileUrl, setActiveFileUrl] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [viewerBlob, setViewerBlob] = useState(null);
  const [fileLogs, setFileLogs] = useState({});
  const [expandedFileId, setExpandedFileId] = useState(null);
  const [breachData, setBreachData] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    expiresInMinutes: "10",
    maxViews: "1",
    file: null,
  });

  async function refreshDashboard() {
    setLoading(true);

    try {
      const [{ files: fileList }, dashboardData] = await Promise.all([
        api.getFiles(token),
        api.getDashboard(token),
      ]);

      setFiles(fileList);
      setStats(dashboardData.stats || statsFallback);
      setRecentLogs(dashboardData.recentLogs || []);
      setRecentAuditLogs(dashboardData.recentAuditLogs || []);
      setUsage(dashboardData.usage || null);
      setPlan(dashboardData.plan || null);
      setBilling(dashboardData.billing || null);
      setCompliance(dashboardData.compliance || null);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshDashboard();
  }, [token]);

  useEffect(() => {
    return () => {
      if (activeFileUrl) {
        URL.revokeObjectURL(activeFileUrl);
      }
    };
  }, [activeFileUrl]);

  function updateUploadField(event) {
    const { name, value, files: fileList } = event.target;
    setUploadForm((current) => ({
      ...current,
      [name]: fileList ? fileList[0] : value,
    }));
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!uploadForm.file) {
      showToast("Choose a file first.", "error");
      return;
    }

    const file = uploadForm.file;
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSizeBytes));
    setUploading(true);
    setUploadProgress(2);

    try {
      const started = await api.startUploadSession(token, {
        title: uploadForm.title,
        description: uploadForm.description,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        totalSize: file.size,
        totalChunks,
        expiresInMinutes: uploadForm.expiresInMinutes,
        maxViews: uploadForm.maxViews,
      });

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const start = chunkIndex * chunkSizeBytes;
        const end = Math.min(start + chunkSizeBytes, file.size);
        const blob = file.slice(start, end);
        await uploadChunkWithRetry(token, started.uploadId, chunkIndex, blob);
        setUploadProgress(Math.round(((chunkIndex + 1) / (totalChunks + 1)) * 100));
      }

      await api.completeUpload(token, started.uploadId);
      setUploadProgress(100);
      showToast("Chunked upload complete. File secured with hybrid encryption.");
      setUploadForm({
        title: "",
        description: "",
        expiresInMinutes: "10",
        maxViews: "1",
        file: null,
      });
      await refreshDashboard();
    } catch (error) {
      if (error instanceof ApiError && error.code === "LIMIT_EXCEEDED") {
        setUpgradePlan(error.requiredPlan || "PRO");
      }
      showToast(error.message, "error");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  }

  async function handleUpgrade(nextPlan) {
    setUpgrading(true);

    try {
      const response = await api.updatePlan(token, nextPlan);
      onUserUpdate?.(response.user);
      setUpgradePlan(null);
      showToast(`Plan switched to ${nextPlan}.`);
      await refreshDashboard();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setUpgrading(false);
    }
  }

  async function handleOpenFile(file) {
    try {
      const access = await api.requestOwnerAccess(token, file.id);
      const content = await api.fetchOwnerContent(token, file.id, access.token);

      if (activeFileUrl) {
        URL.revokeObjectURL(activeFileUrl);
      }

      const objectUrl = URL.createObjectURL(content.blob);
      setActiveFileUrl(objectUrl);
      setViewerBlob(content.blob);
      setViewerFile(access.file);
      showToast("Secure viewer session opened.");
      await refreshDashboard();
    } catch (error) {
      showToast(error.message, "error");
      await refreshDashboard();
    }
  }

  async function handleDestroy(fileId) {
    try {
      await api.destroyFile(token, fileId);
      showToast("Key destroyed. The file is now unreadable.");
      await refreshDashboard();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleDelete(fileId) {
    try {
      await api.deleteFile(token, fileId);
      showToast("Deletion request completed. Key destroyed for GDPR-style erasure.");
      await refreshDashboard();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleExtendExpiry(fileId) {
    try {
      await api.patchExpiry(token, fileId, { expiresInMinutes: 60 });
      showToast("Expiry extended by 60 minutes.");
      await refreshDashboard();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function toggleLogs(fileId) {
    if (expandedFileId === fileId) {
      setExpandedFileId(null);
      return;
    }

    setExpandedFileId(fileId);

    if (fileLogs[fileId]) {
      return;
    }

    try {
      const response = await api.getFileLogs(token, fileId);
      setFileLogs((current) => ({
        ...current,
        [fileId]: response.logs,
      }));
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function copyShareLink(link) {
    try {
      await navigator.clipboard.writeText(link);
      showToast("Secure share link copied.");
    } catch {
      showToast("Clipboard copy failed on this browser.", "error");
    }
  }

  async function handleBreachSimulation(fileId) {
    try {
      const response = await api.simulateBreach(token, fileId);
      setBreachData(response);
      showToast("Breach simulation generated.");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  const statCards = useMemo(
    () => [
      { label: "Total vaults", value: stats.totalFiles },
      { label: "Active keys", value: stats.activeFiles },
      { label: "Destroyed keys", value: stats.destroyedFiles },
      { label: "Viewer opens", value: stats.totalViews },
    ],
    [stats],
  );

  return (
    <>
      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-pulse">Mission Control</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-white">
                  Welcome back, {user.name}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                  Operate Vanish Vault as a compliance-ready SaaS platform with chunked uploads,
                  hybrid encryption, usage metering, and cryptographic deletion.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-slate-300">
                  {user.role} · {user.plan}
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-pulse/40 hover:text-white"
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {statCards.map((card) => (
                <div key={card.label} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{card.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-card">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-pulse">Usage and Billing</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                  Plan-aware secure storage
                </h3>
              </div>
              {plan && (
                <div className="rounded-2xl border border-pulse/20 bg-pulse/10 px-4 py-3 text-sm text-cyan-50">
                  {plan.name} · Max file {plan.maxFileSizeLabel} · Monthly {plan.monthlyUsageLabel}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Used quota</p>
                <p className="mt-3 text-3xl font-semibold text-white">{usage?.monthlyUsageGB ?? 0} GB</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Remaining</p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {usage?.remainingGb ?? "Custom"}{typeof usage?.remainingGb === "number" ? " GB" : ""}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Estimated bill</p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {formatCurrency(billing?.estimatedBill)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-card">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-pulse">Chunked Upload</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                  Launch a new disappearing vault
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Secured with Hybrid Encryption: AES-256 for file streaming and RSA-2048 for the
                  AES key lifecycle in KMS.
                </p>
              </div>
              <div className="rounded-2xl border border-pulse/20 bg-pulse/10 px-4 py-3 text-sm text-cyan-50">
                Chunk size: {formatSize(chunkSizeBytes)}
              </div>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleUpload}>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm text-slate-300">Vault title</span>
                <input
                  name="title"
                  value={uploadForm.title}
                  onChange={updateUploadField}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pulse/60"
                  placeholder="Classified research brief"
                  required
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm text-slate-300">Mission note</span>
                <textarea
                  name="description"
                  value={uploadForm.description}
                  onChange={updateUploadField}
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pulse/60"
                  placeholder="Only the final reviewer should open this once."
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Expiry in minutes</span>
                <input
                  name="expiresInMinutes"
                  type="number"
                  min="1"
                  value={uploadForm.expiresInMinutes}
                  onChange={updateUploadField}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pulse/60"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Maximum views</span>
                <input
                  name="maxViews"
                  type="number"
                  min="1"
                  value={uploadForm.maxViews}
                  onChange={updateUploadField}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pulse/60"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm text-slate-300">Select file</span>
                <input
                  name="file"
                  type="file"
                  onChange={updateUploadField}
                  className="w-full rounded-2xl border border-dashed border-pulse/30 bg-pulse/5 px-4 py-4 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-pulse file:px-4 file:py-2 file:font-semibold file:text-slate-950"
                  required
                />
              </label>

              <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  Selected size: {uploadForm.file ? formatSize(uploadForm.file.size) : "No file"}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  Total chunks:{" "}
                  {uploadForm.file ? Math.max(1, Math.ceil(uploadForm.file.size / chunkSizeBytes)) : 0}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  Active plan: {plan?.name || user.plan}
                </div>
              </div>

              {uploadProgress > 0 && (
                <div className="md:col-span-2">
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pulse to-cyan-300 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-300">Chunk upload progress: {uploadProgress}%</p>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="md:col-span-2 rounded-2xl bg-gradient-to-r from-pulse to-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:scale-[1.01] disabled:opacity-60"
              >
                {uploading ? "Streaming, encrypting, sealing..." : "Upload with hybrid encryption"}
              </button>
            </form>
          </section>
        </div>

        <div className="space-y-8">
          <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-card">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.35em] text-pulse">Compliance</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                Audit and retention overview
              </h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Badge</p>
                <p className="mt-3 text-2xl font-semibold text-white">{compliance?.badge || "GDPR Ready"}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Audit logs</p>
                <p className="mt-3 text-2xl font-semibold text-white">{compliance?.auditLogsCount ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Expired files</p>
                <p className="mt-3 text-2xl font-semibold text-white">{compliance?.expiredFiles ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Deleted files</p>
                <p className="mt-3 text-2xl font-semibold text-white">{compliance?.deletedFiles ?? 0}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-card">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-pulse">Breach Simulation</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                  Demo the unreadable payload
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleBreachSimulation()}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-pulse/40 hover:text-white"
              >
                Run
              </button>
            </div>
            {breachData ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{breachData.file.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{breachData.message}</p>
                </div>
                <pre className="overflow-auto rounded-3xl border border-white/10 bg-slate-900/80 p-4 font-mono text-xs leading-6 text-cyan-50">
                  {breachData.encryptedPreview}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Generate a breach preview to show that ciphertext without the key is meaningless.</p>
            )}
          </section>

          <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-card">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.35em] text-pulse">Vault Inventory</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                Active, destroyed, and deleted vaults
              </h3>
            </div>

            <div className="space-y-4">
              {loading && <p className="text-sm text-slate-400">Loading vaults...</p>}
              {!loading && files.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
                  No vaults yet. Upload your first file to start the demo flow.
                </div>
              )}

              {!loading &&
                files.map((file, index) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-3xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-lg font-semibold text-white">{file.title}</h4>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${statusTone(file.status)}`}
                          >
                            {file.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-slate-300">
                          {file.description || "No mission note attached."}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Size</p>
                        <p className="mt-2 text-lg font-semibold text-white">{file.sizeLabel}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                      <p>Expires: {formatDate(file.rules?.expiresAt)}</p>
                      <p>Max views: {file.rules?.maxViews || "Unlimited"}</p>
                      <p>Encryption: {file.hybridEncryption}</p>
                      <p>Integrity: RSA signature verified</p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenFile(file)}
                        disabled={file.status !== "active"}
                        className="rounded-full bg-pulse px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Open secure viewer
                      </button>
                      <button
                        type="button"
                        onClick={() => copyShareLink(file.shareUrl)}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-pulse/40 hover:text-white"
                      >
                        Copy share link
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleLogs(file.id)}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-pulse/40 hover:text-white"
                      >
                        {expandedFileId === file.id ? "Hide logs" : "Show logs"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExtendExpiry(file.id)}
                        disabled={file.status !== "active"}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-pulse/40 hover:text-white disabled:opacity-50"
                      >
                        Extend 60 min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDestroy(file.id)}
                        disabled={file.status !== "active"}
                        className="rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 transition hover:border-rose-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Manual kill switch
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(file.id)}
                        className="rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-400/40"
                      >
                        GDPR delete
                      </button>
                    </div>

                    {expandedFileId === file.id && (
                      <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                        <p className="mb-3 text-xs uppercase tracking-[0.35em] text-pulse">
                          Access logs
                        </p>
                        <div className="space-y-3">
                          {(fileLogs[file.id] || []).map((log) => (
                            <div key={log.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <p className="font-medium text-white">{log.event}</p>
                              <p className="mt-1 text-sm text-slate-300">{log.message}</p>
                              <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                                {log.actor} · {formatDate(log.createdAt)}
                              </p>
                            </div>
                          ))}
                          {fileLogs[file.id]?.length === 0 && (
                            <p className="text-sm text-slate-400">No activity yet.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-card">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.35em] text-pulse">Compliance Trail</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                Recent access and audit events
              </h3>
            </div>
            <div className="space-y-3">
              {[...recentLogs, ...recentAuditLogs].slice(0, 8).map((log, index) => (
                <div key={`${log.id || log.timestamp}-${index}`} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="font-medium text-white">{log.event || log.action}</p>
                  <p className="mt-1 text-sm text-slate-300">{log.message || log.details}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                    {log.actor || log.ipAddress || "system"} · {formatDate(log.createdAt || log.timestamp)}
                  </p>
                </div>
              ))}
              {recentLogs.length === 0 && recentAuditLogs.length === 0 && (
                <p className="text-sm text-slate-400">Activity will appear as soon as files are uploaded or viewed.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <ViewerModal
        open={Boolean(viewerFile && activeFileUrl)}
        file={viewerFile}
        fileUrl={activeFileUrl}
        blob={viewerBlob}
        viewerLabel={user.email}
        onClose={() => {
          setViewerFile(null);
          setViewerBlob(null);
          if (activeFileUrl) {
            URL.revokeObjectURL(activeFileUrl);
            setActiveFileUrl(null);
          }
        }}
      />

      <UpgradeModal
        open={Boolean(upgradePlan)}
        plan={upgradePlan}
        loading={upgrading}
        onClose={() => setUpgradePlan(null)}
        onUpgrade={handleUpgrade}
      />
    </>
  );
}
