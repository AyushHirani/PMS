import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import mongoose from 'mongoose';
import session from 'express-session';
import bcrypt from 'bcrypt';
import multer from "multer";
import nodemailer from "nodemailer";
import { User } from './models/userModel.js';
import { TenantRequest } from "./models/requestModel.js";
import { Property } from "./models/propertyModel.js";
 
const app = express();
const uri = process.env.URI;
const port = 3000;
const mailTransport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS
    }
});
 
// ---- Database connection ----
mongoose.connect(uri)
    .then(() => console.log("Database Connected!"))
    .catch((error) => console.log(error));
 
// ---- Middleware ----
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
 
app.use(session({
    secret: process.env.KEY,
    resave: false,
    saveUninitialized: true
}));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB maximum
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed."));
        }
    }
});
 
// ---- Helper: create a user with a hashed password ----
async function insert(name, pass, usertype, email) {
    try {
        const hashedPassword = await bcrypt.hash(pass, 10);
        await User.create({
            userName: name,
            password: hashedPassword,
            userType: usertype,
            email: email
        });
    } catch (error) {
        console.error("Error inserting user:", error);
    }
}

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    next();
}
 
// ---- Home page ----
app.get("/", (req, res) => {
    const successMessage = req.query.success;
    res.render("home", { successMessage });
});
 
// ---- Login ----
app.get("/login", (req, res) => {
    const successMessage = req.query.success;
    res.render("login", { successMessage });
});
 
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ userName: username });
        if (!user) {
            return res.redirect("/login");
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.redirect("/login?error=Wrong%20password");
        }
        
        // Save logged-in user
        req.session.userId = user._id;
        req.session.userType = user.userType;

        // Redirect based on user type
        if (user.userType === "Owner") {
            return res.redirect("/property");
        }

        if (user.userType === "Tenant") {
            return res.redirect("/tenant");
        }

        if (user.userType === "Maintenance") {
            return res.redirect("/maintenance");
        }

        // Unknown user type
        return res.redirect("/login");

    } catch (error) {
        console.error("Error logging in:", error);
        res.redirect("/login");
    }
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const { username, password, usertype, email } = req.body;
    try {
        await insert(username, password, usertype, email);
        // Redirect to the home page with a success message
        res.redirect("/?success=Registration%20successful!");
    } catch (error) {
        console.error("Error registering user:", error);
        res.redirect("/?error=Registration%20failed.%20Please%20try%20again.");
    }
});

app.get("/maintenance", requireLogin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.redirect("/login");
        }

        if (user.userType !== "Maintenance") {
            return res.status(403).send("Access denied.");
        }

        const requests = await TenantRequest.find({
            assignedTo: user.userName,
            status: { $in: ["Assigned", "In Progress"] }
        });

        const urgencyPriority = {
            Emergency: 0,
            High: 1,
            Medium: 2,
            Low: 3
        };

        requests.sort((a, b) =>
            urgencyPriority[a.urgency] - urgencyPriority[b.urgency] ||
            b.createdAt - a.createdAt
        );

        const tenantEmails = [...new Set(requests.map(request => request.tenantEmail))];
        const properties = await Property.find({
            tenantEmail: { $in: tenantEmails }
        })
            .populate("ownerId", "userName email")
            .sort({ createdAt: -1 });

        const propertyByTenantEmail = new Map();
        for (const property of properties) {
            if (!propertyByTenantEmail.has(property.tenantEmail)) {
                propertyByTenantEmail.set(property.tenantEmail, property);
            }
        }

        const queue = requests.map(request => ({
            request,
            property: propertyByTenantEmail.get(request.tenantEmail) || null
        }));

        return res.render("maintenance", { queue });
    } catch (error) {
        console.error("Error fetching assigned maintenance requests:", error);
        return res.status(500).send("Unable to load assigned maintenance requests.");
    }
});

app.get("/tenant", requireLogin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.redirect("/login");
        }

        const requests = await TenantRequest.find({
            tenantEmail: user.email,
            status: { $ne: "Rejected" }
        }).sort({ createdAt: -1 });

        res.render("tenant", {
            requests,
            successMessage: req.query.success
        });

    } catch (error) {
        console.error("Error fetching tenant requests:", error);
        res.status(500).send("Unable to load your maintenance requests.");
    }
});

app.post("/tenant", requireLogin, upload.single("photo"), async (req, res) => {
    try {
        const { issue, description, urgency } = req.body;

        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.redirect("/login");
        }

        const requestData = {
            issue,
            description,
            urgency,
            tenantName: user.userName,
            tenantEmail: user.email
        };

        if (req.file) {
            requestData.photo = {
                data: req.file.buffer,
                contentType: req.file.mimetype
            };
        }

        await TenantRequest.create(requestData);

        res.redirect("/tenant?success=Request%20submitted");

    } catch (error) {
        console.error("Error creating maintenance request:", error);
        res.status(500).send("Unable to submit maintenance request.");
    }
});

app.get("/property", requireLogin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.redirect("/login");
        }

        const properties = await Property.find({
            ownerId: user._id
        }).sort({ createdAt: -1 });

        res.render("property", { properties });

    } catch (error) {
        console.error("Error loading properties:", error);
        res.status(500).send("Unable to load properties.");
    }
});

app.post("/property", requireLogin, upload.single("photo"), async (req, res) => {
        try {
            const {
                streetAddress,
                pin,
                city,
                province,
                description,
                tenantName,
                tenantEmail: submittedTenantEmail
            } = req.body;

            // Get the logged-in user
            const user = await User.findById(req.session.userId);

            if (!user) {
                return res.redirect("/login");
            }

            const tenantEmail = submittedTenantEmail?.trim();
            let tenantUser;

            if (tenantEmail) {
                tenantUser = await User.findOne({
                    email: tenantEmail,
                    userType: "Tenant"
                });

                if (!tenantUser) {
                    return res.status(400).send(
                        "No registered tenant account was found for that email address."
                    );
                }
            }

            // Prepare property data
            const propertyData = {
                streetAddress,
                pin,
                city,
                province,
                description,
                tenantName,
                tenantEmail,
                tenantId: tenantUser?._id,
                ownerId: user._id
            };

            // Save the uploaded photo, if provided
            if (req.file) {
                propertyData.photo = {
                    data: req.file.buffer,
                    contentType: req.file.mimetype
                };
            }

            // Create the property in MongoDB
            await Property.create(propertyData);

            // Redirect after successful creation
            return res.redirect(
                "/property?success=" +
                encodeURIComponent("Property created successfully!")
            );

        } catch (error) {
            console.error("Error creating property:", error);

            return res.status(500).send(
                "Unable to create property. Please try again."
            );
        }
    }
);

app.get("/properties/:id/photo", requireLogin, async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);

        if (!property || !property.photo || !property.photo.data) {
            return res.sendStatus(404);
        }

        // Only the owner who created this property can view its photo.
        if (property.ownerId.toString() !== req.session.userId.toString()) {
            return res.sendStatus(403);
        }

        res.set("Content-Type", property.photo.contentType);
        res.set("Cache-Control", "no-store");
        res.send(property.photo.data);

    } catch (error) {
        console.error("Error retrieving property photo:", error);
        res.sendStatus(500);
    }
});

app.get("/new-property", requireLogin, (req, res) => {
    res.render("property-form");
});

app.get("/new-request", requireLogin, (req, res) => {
    res.render("request-form", {
        request: null,
        isEditing: false,
        formAction: "/tenant"
    });
});

app.get("/tenant/requests/:id/edit", requireLogin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.redirect("/login");
        }

        if (user.userType !== "Tenant") {
            return res.status(403).send("Access denied.");
        }

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.sendStatus(404);
        }

        const request = await TenantRequest.findOne({
            _id: req.params.id,
            tenantEmail: user.email
        });

        if (!request) {
            return res.sendStatus(404);
        }

        if (request.status !== "Pending") {
            return res.status(400).send("Only pending requests can be edited.");
        }

        return res.render("request-form", {
            request,
            isEditing: true,
            formAction: `/tenant/requests/${request._id}/edit`
        });
    } catch (error) {
        console.error("Error loading maintenance request for editing:", error);
        return res.status(500).send("Unable to load maintenance request.");
    }
});

app.post(
    "/tenant/requests/:id/edit",
    requireLogin,
    upload.single("photo"),
    async (req, res) => {
        try {
            const user = await User.findById(req.session.userId);

            if (!user) {
                return res.redirect("/login");
            }

            if (user.userType !== "Tenant") {
                return res.status(403).send("Access denied.");
            }

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.sendStatus(404);
            }

            const request = await TenantRequest.findOne({
                _id: req.params.id,
                tenantEmail: user.email
            });

            if (!request) {
                return res.sendStatus(404);
            }

            if (request.status !== "Pending") {
                return res.status(400).send("Only pending requests can be edited.");
            }

            const { issue, description, urgency } = req.body;
            const validUrgencies = ["Low", "Medium", "High", "Emergency"];

            if (
                typeof issue !== "string" ||
                !issue.trim() ||
                typeof description !== "string" ||
                !description.trim() ||
                !validUrgencies.includes(urgency)
            ) {
                return res.status(400).send("Provide an issue, description, and valid urgency.");
            }

            request.issue = issue.trim();
            request.description = description.trim();
            request.urgency = urgency;

            if (req.file) {
                request.photo = {
                    data: req.file.buffer,
                    contentType: req.file.mimetype
                };
            }

            await request.save();

            return res.redirect(
                "/tenant?success=" +
                encodeURIComponent("Request updated successfully!")
            );
        } catch (error) {
            console.error("Error updating maintenance request:", error);
            return res.status(500).send("Unable to update maintenance request.");
        }
    }
);

app.get("/owner-request", requireLogin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.redirect("/login");
        }

        if (user.userType !== "Owner") {
            return res.status(403).send("Access denied.");
        }

        // Find properties belonging to the logged-in owner
        const properties = await Property.find({
            ownerId: user._id
        });

        // Get tenant emails assigned to those properties
        const tenantEmails = properties
            .map(property => property.tenantEmail)
            .filter(email => email);

        // Find requests submitted by those tenants
        const requests = await TenantRequest.find({
            tenantEmail: { $in: tenantEmails },
            status: { $in: ["Assigned", "In Progress", "Pending"] }
        }).sort({ createdAt: -1 });

        res.render("owner-requests", {
            requests,
            properties,
            successMessage: req.query.success
        });

    } catch (error) {
        console.error("Error fetching owner requests:", error);
        res.status(500).send("Unable to load maintenance requests.");
    }
});

app.post("/assign-request", requireLogin, async (req, res) => {
    try {
        const owner = await User.findById(req.session.userId);

        if (!owner) {
            return res.redirect("/login");
        }

        if (owner.userType !== "Owner") {
            return res.status(403).send("Access denied.");
        }

        const properties = await Property.find({ ownerId: owner._id }).select("tenantEmail");
        const tenantEmails = properties
            .map(property => property.tenantEmail)
            .filter(Boolean);
        const request = await TenantRequest.findOne({
            _id: req.body.requestId,
            tenantEmail: { $in: tenantEmails }
        });

        if (!request) {
            return res.sendStatus(404);
        }

        const maintenanceUsers = await User.find({ userType: "Maintenance" })
            .select("userName")
            .sort({ userName: 1 });

        return res.render("assign-request", { request, maintenanceUsers });
    } catch (error) {
        console.error("Error loading request assignment:", error);
        return res.status(500).send("Unable to load request assignment.");
    }
});

app.post("/inquire-request", requireLogin, async (req, res) => {
    try {
        const owner = await User.findById(req.session.userId);

        if (!owner) {
            return res.redirect("/login");
        }

        if (owner.userType !== "Owner") {
            return res.status(403).send("Access denied.");
        }

        const message = typeof req.body.message === "string"
            ? req.body.message.trim()
            : "";

        if (!message || message.length > 2000) {
            return res.status(400).send("Enter an inquiry message of up to 2000 characters.");
        }

        if (!process.env.EMAIL || !process.env.PASS) {
            console.error("Email delivery is not configured.");
            return res.status(500).send("Email service is not configured.");
        }

        if (!mongoose.isValidObjectId(req.body.requestId)) {
            return res.sendStatus(404);
        }

        const properties = await Property.find({ ownerId: owner._id }).select("tenantEmail");
        const tenantEmails = properties
            .map(property => property.tenantEmail)
            .filter(Boolean);
        const request = await TenantRequest.findOne({
            _id: req.body.requestId,
            tenantEmail: { $in: tenantEmails }
        });

        if (!request) {
            return res.sendStatus(404);
        }

        await mailTransport.sendMail({
            from: process.env.EMAIL,
            to: request.tenantEmail,
            replyTo: owner.email || undefined,
            subject: "A question about your maintenance request",
            text: [
                `Hello ${request.tenantName || "Tenant"},`,
                "",
                `${owner.userName} has a question about your maintenance request: "${request.issue}".`,
                "",
                message,
                "",
                "Please reply to this email within 48 hours or your request will be rejected."
            ].join("\n")
        });

        return res.redirect("owner-request?success=" +
                encodeURIComponent("Email sent successfully!")
            );
    } catch (error) {
        console.error("Error emailing maintenance request inquiry:", error);
        return res.status(500).send("Unable to email the tenant inquiry.");
    }
});

app.post("/assign-request/:id", requireLogin, async (req, res) => {
    try {
        const owner = await User.findById(req.session.userId);

        if (!owner) {
            return res.redirect("/login");
        }

        if (owner.userType !== "Owner") {
            return res.status(403).send("Access denied.");
        }

        const maintenanceUser = await User.findOne({
            _id: req.body.maintenanceUserId,
            userType: "Maintenance"
        });

        if (!maintenanceUser) {
            return res.status(400).send("Select a valid maintenance user.");
        }

        const properties = await Property.find({ ownerId: owner._id }).select("tenantEmail");
        const tenantEmails = properties
            .map(property => property.tenantEmail)
            .filter(Boolean);
        const request = await TenantRequest.findOne({
            _id: req.params.id,
            tenantEmail: { $in: tenantEmails }
        });

        if (!request) {
            return res.sendStatus(404);
        }

        request.assignedTo = maintenanceUser.userName;
        request.status = "Assigned";
        await request.save();

        return res.redirect("/owner-request");
    } catch (error) {
        console.error("Error assigning maintenance request:", error);
        return res.status(500).send("Unable to assign maintenance request.");
    }
});

app.post("/reject-request", requireLogin, async (req, res) => {
    try {
        const owner = await User.findById(req.session.userId);

        if (!owner) {
            return res.redirect("/login");
        }

        if (owner.userType !== "Owner") {
            return res.status(403).send("Access denied.");
        }

        const properties = await Property.find({ ownerId: owner._id }).select("tenantEmail");
        const tenantEmails = properties
            .map(property => property.tenantEmail)
            .filter(Boolean);
        const request = await TenantRequest.findOne({
            _id: req.body.requestId,
            tenantEmail: { $in: tenantEmails }
        });

        if (!request) {
            return res.sendStatus(404);
        }

        request.status = "Rejected";
        await request.save();

        return res.redirect("/owner-request");
    } catch (error) {
        console.error("Error rejecting maintenance request:", error);
        return res.status(500).send("Unable to reject maintenance request.");
    }
});

// ---- Logout (optional, pairs with login) ----
app.post("/maintenance/requests/:id/progress", requireLogin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.redirect("/login");
        }

        if (user.userType !== "Maintenance") {
            return res.status(403).send("Access denied.");
        }

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.sendStatus(404);
        }

        if (!["In Progress", "Resolved"].includes(req.body.status)) {
            return res.status(400).send("Select a valid progress status.");
        }

        const request = await TenantRequest.findOne({
            _id: req.params.id,
            assignedTo: user.userName,
            status: { $in: ["Assigned", "In Progress"] }
        });

        if (!request) {
            return res.sendStatus(404);
        }

        let owner;
        if (req.body.status === "Resolved") {
            if (!process.env.EMAIL || !process.env.PASS) {
                console.error("Email delivery is not configured.");
                return res.status(500).send("Email service is not configured.");
            }

            if (!request.tenantEmail) {
                console.error(`No tenant email found for request ${request._id}.`);
                return res.status(500).send("Unable to find the tenant's email.");
            }

            const property = await Property.findOne({
                tenantEmail: request.tenantEmail
            })
                .sort({ createdAt: -1 })
                .populate("ownerId", "userName email");

            owner = property?.ownerId;
            if (!owner?.email) {
                console.error(`No owner email found for request ${request._id}.`);
                return res.status(500).send("Unable to find the property owner's email.");
            }
        }

        request.status = req.body.status;
        await request.save();

        if (req.body.status === "Resolved") {
            const recipients = [
                { email: request.tenantEmail, name: request.tenantName || "Tenant" },
                { email: owner.email, name: owner.userName || "Property owner" }
            ].filter((recipient, index, all) =>
                all.findIndex(other =>
                    other.email.toLowerCase() === recipient.email.toLowerCase()
                ) === index
            );
            const notifications = await Promise.allSettled(
                recipients.map(recipient => mailTransport.sendMail({
                    from: process.env.EMAIL,
                    to: recipient.email,
                    subject: "Maintenance request resolved",
                    text: [
                        `Hello ${recipient.name},`,
                        "",
                        `The maintenance request "${request.issue}" has been resolved.`,
                        "",
                        `Tenant: ${request.tenantName}`,
                        `Assigned maintenance person: ${user.userName}`
                    ].join("\n")
                }))
            );
            const failedNotifications = notifications.filter(result => result.status === "rejected");

            if (failedNotifications.length > 0) {
                failedNotifications.forEach(result =>
                    console.error("Error sending resolution notification:", result.reason)
                );
                return res.status(500).send(
                    "The request was resolved, but one or more notification emails could not be sent."
                );
            }
        }

        return res.redirect("/maintenance");
    } catch (error) {
        console.error("Error updating maintenance request progress:", error);
        return res.status(500).send("Unable to update maintenance request progress.");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.redirect("/");
        }

        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

// ---- Start server on localhost ----
app.listen(port, () => {
    console.log(`Server running on port ${port}.`);
});