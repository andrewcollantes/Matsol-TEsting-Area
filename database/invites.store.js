const { getDb, normalizeToken, persistDb } = require('./memory');

function cloneInvite(invite) {
  return { ...invite };
}

async function createInvite(invite) {
  const db = await getDb();
  const token = normalizeToken(invite.token);

  const nextInvite = {
    token,
    email: String(invite.email || '').trim().toLowerCase(),
    role: String(invite.role || ''),
    branch: String(invite.branch || ''),
    department: String(invite.department || ''),
    status: String(invite.status || 'pending'),
    createdAt: invite.createdAt ? String(invite.createdAt) : null,
    expiresAt: invite.expiresAt ? String(invite.expiresAt) : null,
    acceptedAt: invite.acceptedAt ? String(invite.acceptedAt) : null,
    acceptedUsername: invite.acceptedUsername ? String(invite.acceptedUsername) : null
  };

  const existingIndex = db.invites.findIndex(existing => existing.token === token);
  if (existingIndex >= 0) {
    db.invites[existingIndex] = nextInvite;
  } else {
    db.invites.push(nextInvite);
  }

  await persistDb();

  return invite;
}

async function findInviteByToken(token) {
  const key = normalizeToken(token);
  if (!key) {
    return null;
  }

  const db = await getDb();
  const found = db.invites.find(invite => invite.token === key);
  return found ? cloneInvite(found) : null;
}

async function updateInvite(token, updates) {
  const key = normalizeToken(token);
  const db = await getDb();
  const target = db.invites.find(invite => invite.token === key);

  if (!target) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
    target.email = String(updates.email || '').trim().toLowerCase();
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'role')) {
    target.role = String(updates.role || '');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'branch')) {
    target.branch = String(updates.branch || '');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'department')) {
    target.department = String(updates.department || '');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    target.status = String(updates.status || 'pending');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'createdAt')) {
    target.createdAt = updates.createdAt ? String(updates.createdAt) : null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'expiresAt')) {
    target.expiresAt = updates.expiresAt ? String(updates.expiresAt) : null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'acceptedAt')) {
    target.acceptedAt = updates.acceptedAt ? String(updates.acceptedAt) : null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'acceptedUsername')) {
    target.acceptedUsername = updates.acceptedUsername ? String(updates.acceptedUsername) : null;
  }

  await persistDb();

  return true;
}

module.exports = {
  createInvite,
  findInviteByToken,
  updateInvite
};