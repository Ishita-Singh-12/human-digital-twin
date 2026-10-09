import { Account,Client } from "appwrite";
export function appwriteAccount() {
 const endpoint=process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
 const project=process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
 if(!endpoint||!project)throw new Error("Appwrite account connection is not configured yet");
 return new Account(new Client().setEndpoint(endpoint).setProject(project));
}
