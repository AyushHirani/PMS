import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { User } from "./models/userModel.js";

dotenv.config();

const maintenanceWorkers = [
    {
        userName: "James Wilson",
        email: "james.wilson@example.com",
        password: "James@2026!"
    },
    {
        userName: "Michael Brown",
        email: "michael.brown@example.com",
        password: "Michael@2026!"
    },
    {
        userName: "Daniel Thompson",
        email: "daniel.thompson@example.com",
        password: "Daniel@2026!"
    },
    {
        userName: "Robert Martinez",
        email: "robert.martinez@example.com",
        password: "Robert@2026!"
    },
    {
        userName: "David Anderson",
        email: "david.anderson@example.com",
        password: "David@2026!"
    },
    {
        userName: "Christopher Lee",
        email: "christopher.lee@example.com",
        password: "Chris@2026!"
    },
    {
        userName: "Matthew Taylor",
        email: "matthew.taylor@example.com",
        password: "Matthew@2026!"
    },
    {
        userName: "Andrew Harris",
        email: "andrew.harris@example.com",
        password: "Andrew@2026!"
    },
    {
        userName: "Kevin Clark",
        email: "kevin.clark@example.com",
        password: "Kevin@2026!"
    },
    {
        userName: "Ryan Mitchell",
        email: "ryan.mitchell@example.com",
        password: "Ryan@2026!"
    }
];

async function seedMaintenance() {
    try {
        await mongoose.connect(process.env.URI);

        for (const worker of maintenanceWorkers) {
                const existingUser = await User.findOne({
                        userName: worker.userName
                });

                if (!existingUser) {
                        const hashedPassword = await bcrypt.hash(worker.password, 10);

                        await User.create({
                        userName: worker.userName,
                        email: worker.email,
                        password: hashedPassword,
                        userType: "Maintenance"
                        });

                        console.log(`Created: ${worker.userName}`);
                } else {
                        console.log(`Already exists: ${worker.userName}`);
                }
        }

        console.log("Maintenance worker seeding completed.");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

seedMaintenance();