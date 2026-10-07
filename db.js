// Simple JSON-file "database" for the Campus Grievance Portal.
// Good enough for a mini/final-year project demo: no external DB server
// needed, but the read/write API below is the only place that touches the
// file, so it can be swapped for MySQL/MongoDB later without touching routes.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_FILE = path.join(__dirname, "data", "db.json");

function defaultData() {
  return { users: [], grievances: [], notifications: [], counters: { user: 0, grievance: 0, notification: 0 } };
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    save(defaultData());
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function nextId(data, kind) {
  data.counters[kind] += 1;
  return data.counters[kind];
}

// ---- password hashing (scrypt, built into Node core, no extra dependency) ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

// ---------------------------- Users ----------------------------
function createUser({ name, identifier, email, password, role, department }) {
  const data = load();
  if (data.users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }
  const user = {
    id: nextId(data, "user"),
    name,
    identifier, // register no. for students, staff id for admins
    email,
    passwordHash: hashPassword(password),
    role, // 'student' | 'admin'
    department: department || null,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  save(data);
  return user;
}

function findUserByEmail(email) {
  const data = load();
  return data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(id) {
  const data = load();
  return data.users.find((u) => u.id === Number(id));
}

function listAdmins() {
  const data = load();
  return data.users.filter((u) => u.role === "admin");
}

// -------------------------- Grievances --------------------------
const CATEGORIES = ["Academic", "Hostel", "Infrastructure", "Administration", "Ragging / Harassment", "Other"];
const STATUSES = ["Pending", "In Progress", "Resolved"];

function createGrievance({ studentId, category, description, attachment }) {
  const data = load();
  const g = {
    id: nextId(data, "grievance"),
    trackingCode: `CGP-${new Date().getFullYear()}-${String(data.counters.grievance).padStart(4, "0")}`,
    studentId,
    category,
    description,
    attachment: attachment || null,
    status: "Pending",
    assignedTo: null,
    remarks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.grievances.push(g);
  save(data);
  notify(studentId, `Your grievance ${g.trackingCode} has been submitted and is now Pending.`);
  return g;
}

function listGrievancesForStudent(studentId) {
  const data = load();
  return data.grievances
    .filter((g) => g.studentId === Number(studentId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function listAllGrievances({ status, category } = {}) {
  const data = load();
  return data.grievances
    .filter((g) => (status ? g.status === status : true))
    .filter((g) => (category ? g.category === category : true))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findGrievanceById(id) {
  const data = load();
  return data.grievances.find((g) => g.id === Number(id));
}

function updateGrievance(id, { status, assignedTo, remark, actorName }) {
  const data = load();
  const g = data.grievances.find((x) => x.id === Number(id));
  if (!g) throw new Error("Grievance not found.");
  if (status) g.status = status;
  if (assignedTo !== undefined) g.assignedTo = assignedTo;
  if (remark) g.remarks.push({ by: actorName, text: remark, date: new Date().toISOString() });
  g.updatedAt = new Date().toISOString();
  save(data);
  if (status) {
    notify(g.studentId, `Your grievance ${g.trackingCode} status changed to "${status}".`);
  }
  return g;
}

// ------------------------- Notifications -------------------------
function notify(userId, message) {
  const data = load();
  data.notifications.push({
    id: nextId(data, "notification"),
    userId,
    message,
    read: false,
    date: new Date().toISOString(),
  });
  save(data);
}

function listNotifications(userId) {
  const data = load();
  return data.notifications
    .filter((n) => n.userId === Number(userId))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function markNotificationsRead(userId) {
  const data = load();
  data.notifications.forEach((n) => {
    if (n.userId === Number(userId)) n.read = true;
  });
  save(data);
}

// --------------------------- Reports ---------------------------
function reportStats() {
  const data = load();
  const byStatus = {};
  STATUSES.forEach((s) => (byStatus[s] = 0));
  const byCategory = {};
  CATEGORIES.forEach((c) => (byCategory[c] = 0));
  let totalResolutionHours = 0;
  let resolvedCount = 0;

  data.grievances.forEach((g) => {
    byStatus[g.status] = (byStatus[g.status] || 0) + 1;
    byCategory[g.category] = (byCategory[g.category] || 0) + 1;
    if (g.status === "Resolved") {
      resolvedCount += 1;
      totalResolutionHours += (new Date(g.updatedAt) - new Date(g.createdAt)) / 36e5;
    }
  });

  return {
    total: data.grievances.length,
    byStatus,
    byCategory,
    avgResolutionHours: resolvedCount ? Math.round(totalResolutionHours / resolvedCount) : null,
  };
}

module.exports = {
  CATEGORIES,
  STATUSES,
  createUser,
  findUserByEmail,
  findUserById,
  listAdmins,
  verifyPassword,
  createGrievance,
  listGrievancesForStudent,
  listAllGrievances,
  findGrievanceById,
  updateGrievance,
  listNotifications,
  markNotificationsRead,
  reportStats,
};
