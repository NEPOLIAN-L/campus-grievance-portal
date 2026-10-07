const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------- setup ----
if (!fs.existsSync(path.join(__dirname, "uploads"))) fs.mkdirSync(path.join(__dirname, "uploads"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
  session({
    secret: "campus-grievance-portal-secret", // change this in a real deployment
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 4 },
  })
);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// make the logged-in user + flash-style message available to every view
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  res.locals.title = "Campus Grievance Portal";
  delete req.session.flash;
  next();
});

function flash(req, type, text) {
  req.session.flash = { type, text };
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) return res.status(403).send("Forbidden: wrong role for this page.");
    next();
  };
}

// -------------------------------------------------------------- home/auth --
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  return res.redirect(req.session.user.role === "admin" ? "/admin" : "/dashboard");
});

app.get("/register", (req, res) => res.render("register", { title: "Register", categories: db.CATEGORIES }));

app.post("/register", (req, res) => {
  const { name, identifier, email, password, confirmPassword } = req.body;
  if (!name || !email || !password) {
    flash(req, "error", "Please fill in all required fields.");
    return res.redirect("/register");
  }
  if (password !== confirmPassword) {
    flash(req, "error", "Passwords do not match.");
    return res.redirect("/register");
  }
  try {
    const user = db.createUser({ name, identifier, email, password, role: "student" });
    req.session.user = { id: user.id, name: user.name, role: user.role, email: user.email };
    flash(req, "success", "Account created. Welcome!");
    return res.redirect("/dashboard");
  } catch (err) {
    flash(req, "error", err.message);
    return res.redirect("/register");
  }
});

app.get("/login", (req, res) => res.render("login", { title: "Login" }));

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.findUserByEmail(email || "");
  if (!user || !db.verifyPassword(password || "", user.passwordHash)) {
    flash(req, "error", "Invalid email or password.");
    return res.redirect("/login");
  }
  req.session.user = { id: user.id, name: user.name, role: user.role, email: user.email };
  return res.redirect(user.role === "admin" ? "/admin" : "/dashboard");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ----------------------------------------------------------- notifications --
app.get("/notifications", requireLogin, (req, res) => {
  const list = db.listNotifications(req.session.user.id);
  db.markNotificationsRead(req.session.user.id);
  res.render("notifications", { title: "Notifications", notifications: list });
});

// --------------------------------------------------------- student module --
app.get("/dashboard", requireLogin, requireRole("student"), (req, res) => {
  const grievances = db.listGrievancesForStudent(req.session.user.id);
  res.render("student_dashboard", { title: "My Grievances", grievances });
});

app.get("/grievance/new", requireLogin, requireRole("student"), (req, res) => {
  res.render("submit_grievance", { title: "Submit Grievance", categories: db.CATEGORIES });
});

app.post("/grievance/new", requireLogin, requireRole("student"), upload.single("attachment"), (req, res) => {
  const { category, description } = req.body;
  if (!category || !description) {
    flash(req, "error", "Category and description are required.");
    return res.redirect("/grievance/new");
  }
  const g = db.createGrievance({
    studentId: req.session.user.id,
    category,
    description,
    attachment: req.file ? req.file.filename : null,
  });
  flash(req, "success", `Grievance submitted. Your tracking code is ${g.trackingCode}.`);
  res.redirect("/dashboard");
});

app.get("/grievance/:id", requireLogin, (req, res) => {
  const g = db.findGrievanceById(req.params.id);
  if (!g) return res.status(404).send("Grievance not found.");
  const isOwner = req.session.user.role === "student" && g.studentId === req.session.user.id;
  const isAdmin = req.session.user.role === "admin";
  if (!isOwner && !isAdmin) return res.status(403).send("Forbidden.");
  const student = db.findUserById(g.studentId);
  res.render("grievance_detail", {
    title: `Grievance ${g.trackingCode}`,
    g,
    student,
    statuses: db.STATUSES,
    admins: isAdmin ? db.listAdmins() : [],
  });
});

// ---------------------------------------------------------- admin module --
app.get("/admin", requireLogin, requireRole("admin"), (req, res) => {
  const { status, category } = req.query;
  const grievances = db.listAllGrievances({ status, category });
  res.render("admin/dashboard", {
    title: "Admin Dashboard",
    grievances,
    categories: db.CATEGORIES,
    statuses: db.STATUSES,
    filters: { status: status || "", category: category || "" },
  });
});

app.post("/grievance/:id/update", requireLogin, requireRole("admin"), (req, res) => {
  const { status, assignedTo, remark } = req.body;
  db.updateGrievance(req.params.id, {
    status: status || undefined,
    assignedTo: assignedTo ? Number(assignedTo) : undefined,
    remark: remark || undefined,
    actorName: req.session.user.name,
  });
  flash(req, "success", "Grievance updated.");
  res.redirect(`/grievance/${req.params.id}`);
});

app.get("/admin/reports", requireLogin, requireRole("admin"), (req, res) => {
  const stats = db.reportStats();
  res.render("admin/reports", { title: "Reports", stats });
});

// ------------------------------------------------------------------ 404 --
app.use((req, res) => res.status(404).render("404"));

app.listen(PORT, () => {
  console.log(`Campus Grievance Portal running at http://localhost:${PORT}`);
});
