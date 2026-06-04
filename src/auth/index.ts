// Public auth barrel — consumers import from "@/auth".
// (Replaces the phase-04 anonymous seam with the real Auth.js v5 config.)
export { auth, handlers, signIn, signOut } from "./config";
export { isAdmin, isStaff } from "./roles";
