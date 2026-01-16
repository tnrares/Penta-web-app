import { createAuthClient } from "better-auth/vue"

export const authClient = createAuthClient({
    baseURL: "http://localhost:3001" 
})

export const { 
    signIn, 
    signUp, 
    useSession, 
    signOut 
} = authClient