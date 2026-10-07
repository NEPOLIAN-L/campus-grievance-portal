// Run once (npm run seed) to create a default admin account.
const db = require("./db");

const email = "admin@college.edu";
const password = "admin123";

if (db.findUserByEmail(email)) {
  console.log("Default admin already exists:", email);
} else {
  db.createUser({
    name: "Grievance Admin",
    identifier: "ADMIN001",
    email,
    password,
    role: "admin",
    department: "Administration",
  });
  console.log("Default admin created.");
  console.log("  Email   :", email);
  console.log("  Password:", password);
  console.log("Change the password after first login in a real deployment.");
}
