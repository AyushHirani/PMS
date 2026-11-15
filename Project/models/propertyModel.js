import mongoose from "mongoose";

const propertySchema = new mongoose.Schema({
    streetAddress: {
        type: String,
        required: true
    },
    pin: String,
    city: String,
    province: String,
    description: String,
    photo: {
        data: Buffer,         
        contentType: String   
    },
    tenantName: String,
    tenantEmail: String, 
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }       
}, { timestamps: true });

export const Property = mongoose.model('Properties', propertySchema);