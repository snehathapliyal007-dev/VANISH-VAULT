import {
  getSharedFileMetadata,
  issueSharedAccess,
  streamFileContentToResponse,
} from "../services/vaultService.js";

export async function sharedMetadata(req, res) {
  const file = await getSharedFileMetadata(req.params.shareToken);

  if (!file) {
    return res.status(404).json({ message: "Shared file not found." });
  }

  return res.json({ file });
}

export async function requestSharedAccessController(req, res) {
  const result = await issueSharedAccess(req.params.shareToken, req.body?.visitorName, req.ip);

  if (result.error) {
    if (result.error === "not_found") {
      return res.status(404).json({ message: "Shared file not found." });
    }

    return res.status(410).json({
      message: "This shared vault can no longer be opened.",
      file: result.file,
    });
  }

  return res.json(result);
}

export async function sharedContent(req, res) {
  const accessToken = req.query.accessToken;

  if (!accessToken) {
    return res.status(400).json({ message: "Missing secure access token." });
  }

  try {
    await streamFileContentToResponse(accessToken, res, req.ip);
    return undefined;
  } catch (error) {
    return res.status(410).json({ message: error.message });
  }
}
