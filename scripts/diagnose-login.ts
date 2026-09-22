import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { loadProjectEnv } from "./load-env";

loadProjectEnv();

function present(name: string) {
  return Boolean(process.env[name]?.trim());
}

async function main() {
  const keys = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  console.log("CLIENT_ENV", keys.every(present) ? "PASS" : "FAIL");

  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });

  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error("USAGE_EMAIL_PASSWORD");
    process.exit(1);
  }

  try {
    const credential = await signInWithEmailAndPassword(getAuth(app), email, password);
    console.log("AUTH_SIGNIN", "PASS");
    const db = getFirestore(app);
    const userSnap = await getDoc(doc(db, `users/${credential.user.uid}`));
    console.log("USER_DOC", userSnap.exists() ? "PASS" : "MISSING");
    const businessId = userSnap.data()?.defaultBusinessId;
    if (businessId) {
      const businessSnap = await getDoc(doc(db, `businesses/${businessId}`));
      const memberSnap = await getDoc(doc(db, `businesses/${businessId}/members/${credential.user.uid}`));
      console.log("BUSINESS_DOC", businessSnap.exists() ? "PASS" : "MISSING");
      console.log("MEMBER_DOC", memberSnap.exists() ? "PASS" : "MISSING");
    }
    await signOut(getAuth(app));
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "unknown";
    console.log("LOGIN_ERROR_CODE", code);
    process.exit(1);
  }
}

main();
