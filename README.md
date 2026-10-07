# Campus Grievance Portal

A full-stack web application that lets students submit grievances online, track
their status in real time, and lets administrators assign, resolve, and report
on them from a central dashboard — replacing the manual, paper-based complaint
process described in the project report.

## Tech Stack

- **Backend:** Node.js, Express
- **Views:** EJS (server-rendered HTML)
- **Database:** a lightweight JSON file store (`data/db.json`) managed through
  `db.js` — all data access goes through that one module, so it can be swapped
  for MySQL / MongoDB later without touching the routes.
- **Auth:** session-based login (`express-session`), passwords hashed with
  Node's built-in `crypto.scrypt` (no extra dependency).
- **File uploads:** `multer`, for optional grievance attachments.

## Project Structure

```
campus-grievance-portal/
├── server.js          # routes & app setup
├── db.js              # data layer (users, grievances, notifications, reports)
├── seed.js            # creates the default admin account
├── data/db.json        # created automatically on first run
├── uploads/            # grievance attachments, created automatically
├── views/               # EJS templates
│   ├── partials/         # shared header/footer (navbar)
│   ├── admin/             # admin dashboard & reports
│   ├── login.ejs, register.ejs
│   ├── student_dashboard.ejs, submit_grievance.ejs
│   ├── grievance_detail.ejs   # shared track/review page (student + admin)
│   └── notifications.ejs
└── public/css/style.css
```

## Setup

```bash
npm install
npm run seed     # creates the default admin account (run once)
npm start
```

Then open **http://localhost:3000**.

### Default admin login
```
Email:    admin@college.edu
Password: admin123
```
Change this password (or create a new admin and remove the seeded one) before
any real deployment.

### Student accounts
Students create their own account from the **Register** page — no seeding
needed.

## Modules (matches the project report)

| Module | Where it lives |
|---|---|
| Student Registration & Login | `/register`, `/login` |
| Grievance Submission | `/grievance/new` |
| Grievance Tracking & Status Update | `/dashboard`, `/grievance/:id` |
| Admin / Staff Dashboard | `/admin` (filter by status/category, assign, resolve) |
| Notification & Alerts | `/notifications` (in-app; triggered on submit & status change) |
| Report Generation & Analytics | `/admin/reports` (totals, by status, by category, avg. resolution time) |

## Notes for the viva / demo

- Every grievance gets a tracking code like `CGP-2026-0001`.
- Status history and staff remarks are kept per grievance and shown on the
  detail page to both the student and the admin.
- The JSON data store is intentionally simple for a project demo. To move to
  MySQL/MongoDB for a production version, only `db.js` needs to change — the
  function signatures (`createUser`, `createGrievance`, `updateGrievance`,
  etc.) can stay the same so `server.js` and the views don't need to change.
- `data/db.json` and `uploads/` are created automatically the first time the
  app runs; delete `data/db.json` to reset all data.
