import mongoose from "mongoose";

const tenantRequestSchema = new mongoose.Schema({
    issue: {
        type: String,
        required: true
    },

    description: {
        type: String,
        required: true
    },

    photo: {
        data: Buffer,
        contentType: String
    },

    urgency: {
        type: String,
        enum: ["Low", "Medium", "High", "Emergency"],
        required: true
    },

    status: {
        type: String,
        enum: ["Pending", "Assigned", "In Progress", "Resolved", "Rejected"],
        default: "Pending"
    },

    tenantName: {
        type: String,
        required: true
    },

    tenantEmail: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    },

    assignedTo: {
        type: String,
        default: null
    }
});

export const TenantRequest = mongoose.model('Requests', tenantRequestSchema);