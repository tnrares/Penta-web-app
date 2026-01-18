import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@Penta-web-app/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", 
  }),
  emailAndPassword: {
    enabled: true, 
  },
  
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "CLIENT", 
      },
    },
  },
  trustedOrigins: ["http://localhost:3000"],
});