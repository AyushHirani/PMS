# Property Maintenance Solutions

A full-stack property management web application built with Node.js, Express, EJS, and MongoDB. The platform supports three user roles—Owner, Tenant, and Maintenance Staff—and streamlines communication around property records, maintenance requests, and issue resolution.

## Overview

This project helps property owners manage rental properties, lets tenants submit maintenance requests, and enables maintenance teams to track and resolve assigned work. It includes role-based access control, photo uploads, request prioritization, and email notifications.

## Features

- User registration and secure login
- Role-based dashboards for owners, tenants, and maintenance staff
- Property registration with tenant linkage and photo support
- Maintenance request submission with urgency levels
- Request assignment and reassignment workflows
- Request status tracking: Pending, Assigned, In Progress, Resolved, Rejected
- Email notifications for tenant inquiries and resolved issues
- Property and request photo uploads using Multer
- MongoDB-backed persistent data storage

## Tech Stack

- Node.js
- Express.js
- EJS templates
- MongoDB with Mongoose
- bcrypt for password hashing
- express-session for authentication
- Multer for image uploads
- Nodemailer for email notifications
- dotenv for environment configuration

## Project Structure

```text
PMS/
└── Project/
    ├── index.js
    ├── package.json
    ├── README.md
    ├── .gitignore
    ├── env
    ├── models/
    │   ├── propertyModel.js
    │   ├── requestModel.js
    │   └── userModel.js
    ├── public/
    │   └── css/
    │       └── styles.css
    └── Views/
        ├── home.ejs
        ├── login.ejs
        ├── register.ejs
        ├── tenant.ejs
        ├── property.ejs
        ├── property-form.ejs
        ├── request-form.ejs
        ├── owner-requests.ejs
        ├── assign-request.ejs
        ├── maintenance.ejs
        └── Partials/
            ├── header.ejs
            ├── nav.ejs
            ├── nav-display.ejs
            ├── nav-property.ejs
            ├── footer.ejs
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root with the following variables:

```env
URI=your_mongodb_connection_string
KEY=your_session_secret
EMAIL=your_email_address
PASS=your_email_app_password
```

Notes:
- `URI` should point to your MongoDB database.
- `KEY` is used for Express session security.
- `EMAIL` and `PASS` are used for sending notifications from the app.

### 3. Start the application

```bash
node index.js
```

Then open the app in your browser at:

```text
http://localhost:3000
```

## Role-Based Workflow

### Owner
- Register property details and attach tenant information
- View maintenance requests submitted by tenants for owned properties
- Update urgency levels
- Assign maintenance tasks
- Reject requests or send tenant inquiries via email

### Tenant
- Sign up and log in
- Submit maintenance requests with issue details and urgency
- Upload a related image when needed
- Track request status
- Edit pending requests

### Maintenance Staff
- View assigned maintenance work
- Update request status to In Progress or Resolved
- Receive notifications when a request is resolved

## Routes Overview

| Route | Description |
| --- | --- |
| `/` | Home page |
| `/login` | User sign-in |
| `/register` | New user registration |
| `/tenant` | Tenant dashboard and request list |
| `/property` | Owner property management page |
| `/owner-request` | Owner review of tenant requests |
| `/maintenance` | Maintenance team work queue |
| `/logout` | End current session |

## Database Models

### User
Stores account information and role assignments.

### Property
Tracks owner and tenant relationships for rental properties, including basic property details and optional photos.

### TenantRequest
Stores issue description, urgency, status, assigned maintenance worker, and optional uploaded photo.

## Notes

- The project currently has no automated test suite configured in `package.json`.
- Email delivery depends on valid SMTP/Gmail application credentials being configured in the environment.
- The app is designed for local development and can be extended with authentication guards, validation, admin tools, and a more polished UI.

## License

This project is currently licensed under the ISC license, as defined in `package.json`.
