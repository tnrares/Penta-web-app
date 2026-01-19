import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@Penta-web-app/db"; 

const isDevelopment = process.env.NODE_ENV !== "production";

export const auth = betterAuth<BetterAuthOptions>({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    trustedOrigins: [
        process.env.CORS_ORIGIN || "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ], 
    
    emailAndPassword: {
        enabled: true,
    },

    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "CLIENT", 
                input: false 
            },
        },
    },

    advanced: {
        defaultCookieAttributes: {
            sameSite: isDevelopment ? "lax" : "none",
            secure: !isDevelopment,
            httpOnly: true,
        },
    },
});