import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE = 'auth:allowPendingPasswordChange';
export const REQUIRES_STEP_UP = 'auth:requiresStepUp';

/** Reachable while mustChangePassword is set (only /auth/me and /auth/change-password). */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE, true);

/** Sensitive actions: the session must have re-entered the password recently (POST /auth/step-up). */
export const RequireStepUp = () => SetMetadata(REQUIRES_STEP_UP, true);
