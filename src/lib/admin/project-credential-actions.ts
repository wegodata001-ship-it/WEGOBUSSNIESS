/** Pure UI enablement rules for the project password vault controls. */

export function hasReauthPassword(accountPassword: string | null | undefined) {
  return Boolean(accountPassword?.trim());
}

export function canRevealProjectCredential(input: {
  passwordConfigured: boolean;
  encryptionReady: boolean;
  credentialBusy: boolean;
  accountPassword: string;
}) {
  return (
    input.passwordConfigured
    && input.encryptionReady
    && !input.credentialBusy
    && hasReauthPassword(input.accountPassword)
  );
}

export function canCopyProjectCredential(input: {
  revealedPassword: string | null;
  credentialBusy: boolean;
}) {
  return Boolean(input.revealedPassword) && !input.credentialBusy;
}

export function canDeleteProjectCredential(input: {
  passwordConfigured: boolean;
  encryptionReady: boolean;
  credentialBusy: boolean;
  accountPassword: string;
}) {
  return (
    input.passwordConfigured
    && input.encryptionReady
    && !input.credentialBusy
    && hasReauthPassword(input.accountPassword)
  );
}

export function canSaveProjectCredential(input: {
  encryptionReady: boolean;
  credentialBusy: boolean;
  passwordDraft: string;
  accountPassword: string;
}) {
  return (
    input.encryptionReady
    && !input.credentialBusy
    && Boolean(input.passwordDraft.trim())
    && hasReauthPassword(input.accountPassword)
  );
}

/**
 * Credential form fields must reset only when switching projects —
 * not when credential status reloads after save/catalog refresh.
 */
export function shouldResetCredentialForm(previousProjectId: string | null, nextProjectId: string) {
  return previousProjectId !== nextProjectId;
}
