import fs from "node:fs/promises";
import { config } from "../config.js";

const initialDb = {
  users: [],
  files: [],
  accessLogs: [],
  auditLogs: [],
  usageRecords: [],
  uploadSessions: [],
};

let writeQueue = Promise.resolve();

function withDefaults(db) {
  return {
    users: Array.isArray(db.users) ? db.users : [],
    files: Array.isArray(db.files) ? db.files : [],
    accessLogs: Array.isArray(db.accessLogs) ? db.accessLogs : [],
    auditLogs: Array.isArray(db.auditLogs) ? db.auditLogs : [],
    usageRecords: Array.isArray(db.usageRecords) ? db.usageRecords : [],
    uploadSessions: Array.isArray(db.uploadSessions) ? db.uploadSessions : [],
  };
}

async function ensureDb() {
  await fs.mkdir(config.dataDir, { recursive: true });

  try {
    await fs.access(config.dbPath);
  } catch {
    await fs.writeFile(config.dbPath, JSON.stringify(initialDb, null, 2));
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(config.dbPath, "utf8");
  return withDefaults(JSON.parse(raw));
}

async function writeDb(db) {
  await fs.writeFile(config.dbPath, JSON.stringify(withDefaults(db), null, 2));
}

async function mutateDb(mutator) {
  writeQueue = writeQueue.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  });

  return writeQueue;
}

export async function initializeDb() {
  await ensureDb();
}

export async function createUser(user) {
  return mutateDb(async (db) => {
    db.users.push(user);
    return user;
  });
}

export async function updateUser(id, updates) {
  return mutateDb(async (db) => {
    const user = db.users.find((entry) => entry.id === id);

    if (!user) {
      return null;
    }

    Object.assign(user, updates);
    return user;
  });
}

export async function findUserByEmail(email) {
  const db = await readDb();
  return db.users.find((user) => user.email === email.toLowerCase());
}

export async function findUserById(id) {
  const db = await readDb();
  return db.users.find((user) => user.id === id);
}

export async function listUsers() {
  const db = await readDb();
  return db.users;
}

export async function insertFileRecord(file) {
  return mutateDb(async (db) => {
    db.files.push(file);
    return file;
  });
}

export async function listFilesByOwner(ownerId) {
  const db = await readDb();
  return db.files
    .filter((file) => file.ownerId === ownerId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function listAllFiles() {
  const db = await readDb();
  return db.files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function findFileById(id) {
  const db = await readDb();
  return db.files.find((file) => file.id === id);
}

export async function findFileByShareToken(shareToken) {
  const db = await readDb();
  return db.files.find((file) => file.shareToken === shareToken);
}

export async function updateFileRecord(id, updates) {
  return mutateDb(async (db) => {
    const file = db.files.find((entry) => entry.id === id);

    if (!file) {
      return null;
    }

    Object.assign(file, updates);
    return file;
  });
}

export async function addAccessLog(log) {
  return mutateDb(async (db) => {
    db.accessLogs.push(log);
    return log;
  });
}

export async function listLogsByFileId(fileId) {
  const db = await readDb();
  return db.accessLogs
    .filter((log) => log.fileId === fileId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function addAuditLog(log) {
  return mutateDb(async (db) => {
    db.auditLogs.push(log);
    return log;
  });
}

export async function listAuditLogsByUserId(userId) {
  const db = await readDb();
  return db.auditLogs
    .filter((log) => log.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export async function listAuditLogsByFileId(fileId) {
  const db = await readDb();
  return db.auditLogs
    .filter((log) => log.fileId === fileId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export async function countAuditLogsForUser(userId) {
  const logs = await listAuditLogsByUserId(userId);
  return logs.length;
}

export async function findUsageRecordByUserId(userId) {
  const db = await readDb();
  return db.usageRecords.find((record) => record.userId === userId) || null;
}

export async function upsertUsageRecord(record) {
  return mutateDb(async (db) => {
    const existingIndex = db.usageRecords.findIndex((entry) => entry.userId === record.userId);

    if (existingIndex >= 0) {
      db.usageRecords[existingIndex] = record;
    } else {
      db.usageRecords.push(record);
    }

    return record;
  });
}

export async function createUploadSession(session) {
  return mutateDb(async (db) => {
    db.uploadSessions.push(session);
    return session;
  });
}

export async function findUploadSessionById(id) {
  const db = await readDb();
  return db.uploadSessions.find((session) => session.id === id) || null;
}

export async function updateUploadSession(id, updates) {
  return mutateDb(async (db) => {
    const session = db.uploadSessions.find((entry) => entry.id === id);

    if (!session) {
      return null;
    }

    Object.assign(session, updates);
    return session;
  });
}

export async function deleteUploadSession(id) {
  return mutateDb(async (db) => {
    const index = db.uploadSessions.findIndex((entry) => entry.id === id);

    if (index < 0) {
      return false;
    }

    db.uploadSessions.splice(index, 1);
    return true;
  });
}

export async function listUploadSessions() {
  const db = await readDb();
  return db.uploadSessions;
}
