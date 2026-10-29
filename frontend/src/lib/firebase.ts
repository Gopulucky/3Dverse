"use client";

// Web configuration is public. Admin credentials belong only on the backend.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every(Boolean);

export async function firebaseAuth() {
  if (!firebaseConfigured) throw new Error("Google sign-in is currently unavailable. Please use email.");
  const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([
    import("firebase/app"), import("firebase/auth"),
  ]);
  const app = getApps().find((app) => app.name === "3dverse-web") || initializeApp(config, "3dverse-web");
  return getAuth(app);
}

export async function googleSignIn() {
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(await firebaseAuth(), provider);
}

export async function emailSignIn(email: string, password: string, create = false) {
  const sdk = await import("firebase/auth");
  const auth = await firebaseAuth();
  const credential = await (create ? sdk.createUserWithEmailAndPassword : sdk.signInWithEmailAndPassword)(auth, email, password);
  if (create) await sdk.sendEmailVerification(credential.user);
  return credential;
}

export async function firebaseReset(email: string) {
  const { sendPasswordResetEmail } = await import("firebase/auth");
  await sendPasswordResetEmail(await firebaseAuth(), email);
}

export async function firebaseVerifyEmail() {
  const { sendEmailVerification } = await import("firebase/auth");
  const auth = await firebaseAuth();
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error("Please sign in again");
  await sendEmailVerification(auth.currentUser);
}

export async function currentFirebaseToken() {
  const auth = await firebaseAuth();
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error("Please sign in again");
  return auth.currentUser.getIdToken(); // SDK refreshes before expiry.
}

export async function firebaseSignOut() {
  if (!firebaseConfigured) return;
  const { signOut } = await import("firebase/auth");
  await signOut(await firebaseAuth());
}

export async function reauthenticateFirebase(password: string) {
  const sdk = await import("firebase/auth");
  const auth = await firebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again");
  if (user.providerData.some((provider) => provider.providerId === "password")) {
    await sdk.reauthenticateWithCredential(user, sdk.EmailAuthProvider.credential(user.email!, password));
  } else {
    await sdk.reauthenticateWithPopup(user, new sdk.GoogleAuthProvider());
  }
  return user.getIdToken(true);
}

export async function changeFirebasePassword(currentPassword: string, newPassword: string) {
  await reauthenticateFirebase(currentPassword);
  const { updatePassword } = await import("firebase/auth");
  const user = (await firebaseAuth()).currentUser;
  if (!user) throw new Error("Please sign in again");
  await updatePassword(user, newPassword);
}

export function signInError(error: unknown) {
  const value = error as { code?: string; detail?: string; message?: string };
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Check your email and password, then try again.",
    "auth/email-already-in-use": "This email already has an account. Sign in instead.",
    "auth/popup-closed-by-user": "The Google window closed. You can try again or use email.",
    "auth/popup-blocked": "Allow the Google sign-in window, or use email instead.",
    "auth/account-exists-with-different-credential": "Use the email sign-in you originally chose for this account.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "Check your connection and try again.",
    "auth/weak-password": "Choose a stronger password with at least 8 characters.",
    "auth/unauthorized-domain": "Google sign-in is temporarily unavailable. Please use email.",
    "auth/operation-not-allowed": "This sign-in method is temporarily unavailable.",
    "auth/requires-recent-login": "Please sign in again before changing your account.",
  };
  return (value.code && messages[value.code]) || value.detail || "Could not complete sign-in. Please try again.";
}
