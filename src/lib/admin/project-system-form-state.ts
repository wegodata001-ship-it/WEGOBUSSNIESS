import { emptyProjectSystemDetails, type ProjectSystemDetails } from "@/types/project-system";

/**
 * Prevent catalog/focus reloads from wiping in-progress edits.
 * Only remount/reset form state when the projectId changes.
 */
export function resolveProjectSystemFormSync(input: {
  previousProjectId: string | null;
  nextProjectId: string;
  dirty: boolean;
  incoming: ProjectSystemDetails | null | undefined;
  current: ProjectSystemDetails;
}): {
  form: ProjectSystemDetails;
  dirty: boolean;
  didReset: boolean;
} {
  if (!input.nextProjectId) {
    return { form: emptyProjectSystemDetails(), dirty: false, didReset: true };
  }

  if (input.previousProjectId !== input.nextProjectId) {
    return {
      form: input.incoming ?? emptyProjectSystemDetails(),
      dirty: false,
      didReset: true,
    };
  }

  if (input.dirty) {
    return { form: input.current, dirty: true, didReset: false };
  }

  return { form: input.current, dirty: false, didReset: false };
}
