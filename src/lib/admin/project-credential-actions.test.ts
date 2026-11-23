import assert from "node:assert/strict";
import {
  canCopyProjectCredential,
  canDeleteProjectCredential,
  canRevealProjectCredential,
  canSaveProjectCredential,
  hasReauthPassword,
  shouldResetCredentialForm,
} from "@/lib/admin/project-credential-actions";

assert.equal(hasReauthPassword(""), false);
assert.equal(hasReauthPassword("   "), false);
assert.equal(hasReauthPassword("owner-pass"), true);

// Regression: with a saved vault + owner reauth typed, reveal/delete must enable.
assert.equal(
  canRevealProjectCredential({
    passwordConfigured: true,
    encryptionReady: true,
    credentialBusy: false,
    accountPassword: "owner-pass",
  }),
  true,
);
assert.equal(
  canDeleteProjectCredential({
    passwordConfigured: true,
    encryptionReady: true,
    credentialBusy: false,
    accountPassword: "owner-pass",
  }),
  true,
);

// Without reauth, actions stay disabled (buttons gray until account password entered).
assert.equal(
  canRevealProjectCredential({
    passwordConfigured: true,
    encryptionReady: true,
    credentialBusy: false,
    accountPassword: "",
  }),
  false,
);
assert.equal(
  canDeleteProjectCredential({
    passwordConfigured: true,
    encryptionReady: true,
    credentialBusy: false,
    accountPassword: "",
  }),
  false,
);

// Copy only after a successful reveal.
assert.equal(canCopyProjectCredential({ revealedPassword: null, credentialBusy: false }), false);
assert.equal(canCopyProjectCredential({ revealedPassword: "vault-secret", credentialBusy: false }), true);
assert.equal(canCopyProjectCredential({ revealedPassword: "vault-secret", credentialBusy: true }), false);

assert.equal(
  canSaveProjectCredential({
    encryptionReady: true,
    credentialBusy: false,
    passwordDraft: "new-pass",
    accountPassword: "owner-pass",
  }),
  true,
);

// Status reload after save must NOT wipe the form; only project switches reset.
assert.equal(shouldResetCredentialForm("p1", "p1"), false);
assert.equal(shouldResetCredentialForm("p1", "p2"), true);
assert.equal(shouldResetCredentialForm(null, "p1"), true);

console.log("project-credential-actions.test.ts: OK");
