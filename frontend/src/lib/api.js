const defaultHeaders = {
  Accept: "application/json",
};

class ApiError extends Error {
  constructor(message, payload = {}) {
    super(message);
    this.name = "ApiError";
    this.code = payload.error || payload.code || null;
    this.requiredPlan = payload.requiredPlan || null;
    this.payload = payload;
  }
}

async function parseErrorPayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return {
    message: await response.text(),
  };
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.body instanceof FormData || options.body instanceof Blob
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new ApiError(payload.message || "Something went wrong.", payload);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.blob();
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export { ApiError };

export const api = {
  signup(payload) {
    return request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getMe(token) {
    return request("/api/auth/me", {
      headers: authHeaders(token),
    });
  },
  updatePlan(token, plan) {
    return request("/api/account/plan", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ plan }),
    });
  },
  getFiles(token) {
    return request("/api/files", {
      headers: authHeaders(token),
    });
  },
  getDashboard(token) {
    return request("/api/files/dashboard", {
      headers: authHeaders(token),
    });
  },
  uploadFile(token, formData) {
    return request("/api/files/upload", {
      method: "POST",
      headers: authHeaders(token),
      body: formData,
    });
  },
  startUploadSession(token, payload) {
    return request("/api/files/start-upload", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
  },
  uploadChunk(token, uploadId, chunkIndex, blob) {
    return request(`/api/files/upload-chunk/${uploadId}/${chunkIndex}`, {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/octet-stream",
      },
      body: blob,
    });
  },
  getUploadStatus(token, uploadId) {
    return request(`/api/files/upload-status/${uploadId}`, {
      headers: authHeaders(token),
    });
  },
  completeUpload(token, uploadId) {
    return request(`/api/files/complete-upload/${uploadId}`, {
      method: "POST",
      headers: authHeaders(token),
    });
  },
  requestOwnerAccess(token, fileId) {
    return request(`/api/files/${fileId}/request-access`, {
      method: "POST",
      headers: authHeaders(token),
    });
  },
  destroyFile(token, fileId) {
    return request(`/api/files/${fileId}/destroy`, {
      method: "POST",
      headers: authHeaders(token),
    });
  },
  deleteFile(token, fileId) {
    return request(`/api/files/${fileId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
  },
  patchExpiry(token, fileId, payload) {
    return request(`/api/files/${fileId}/expiry`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
  },
  getFileLogs(token, fileId) {
    return request(`/api/files/${fileId}/logs`, {
      headers: authHeaders(token),
    });
  },
  simulateBreach(token, fileId) {
    const query = fileId ? `?fileId=${encodeURIComponent(fileId)}` : "";
    return request(`/api/files/simulate-breach${query}`, {
      headers: authHeaders(token),
    });
  },
  async fetchOwnerContent(token, fileId, accessToken) {
    const response = await fetch(
      `/api/files/content/${fileId}?accessToken=${encodeURIComponent(accessToken)}`,
      {
        headers: authHeaders(token),
      },
    );

    if (!response.ok) {
      const payload = await parseErrorPayload(response);
      throw new ApiError(payload.message || "Unable to open file.", payload);
    }

    return {
      blob: await response.blob(),
      mimeType: response.headers.get("content-type") || "application/octet-stream",
    };
  },
  getSharedMetadata(shareToken) {
    return request(`/api/shared/${shareToken}`);
  },
  requestSharedAccess(shareToken, visitorName) {
    return request(`/api/shared/${shareToken}/request-access`, {
      method: "POST",
      body: JSON.stringify({ visitorName }),
    });
  },
  async fetchSharedContent(shareToken, accessToken) {
    const response = await fetch(
      `/api/shared/${shareToken}/content?accessToken=${encodeURIComponent(accessToken)}`,
    );

    if (!response.ok) {
      const payload = await parseErrorPayload(response);
      throw new ApiError(payload.message || "Unable to open shared file.", payload);
    }

    return {
      blob: await response.blob(),
      mimeType: response.headers.get("content-type") || "application/octet-stream",
    };
  },
};
