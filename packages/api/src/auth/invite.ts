import { Types } from 'mongoose';
import { logger, hashToken, getRandomValues } from '@librechat/data-schemas';

export interface InviteDeps {
  createToken: (data: {
    userId: Types.ObjectId;
    email: string;
    token: string;
    createdAt: number;
    expiresIn: number;
    metadata?: { role: string };
  }) => Promise<unknown>;
  findToken: (filter: { token: string; email: string }) => Promise<unknown>;
}

/**
 * Creates a new user invite and returns the encoded token.
 * The intended `role` (already validated by the caller) is persisted in the token's
 * metadata so registration can apply it — it survives the 7-day expiry window.
 */
export async function createInvite(
  email: string,
  deps: InviteDeps,
  role?: string,
): Promise<string | { message: string }> {
  try {
    const token = await getRandomValues(32);
    const hash = await hashToken(token);
    const encodedToken = encodeURIComponent(token);
    const fakeUserId = new Types.ObjectId();

    await deps.createToken({
      userId: fakeUserId,
      email,
      token: hash,
      createdAt: Date.now(),
      expiresIn: 604800,
      ...(role ? { metadata: { role } } : {}),
    });

    return encodedToken;
  } catch (error) {
    logger.error('[createInvite] Error creating invite', error);
    return { message: 'Error creating invite' };
  }
}

/**
 * Reads the intended role off a redeemed invite's metadata, if any.
 * Handles both a Mongoose `Map` and a plain object; returns undefined when absent.
 * The role lives only in the server-stored invite — never in the registration body.
 */
export function getInviteRole(invite: unknown): string | undefined {
  const metadata = (invite as { metadata?: Map<string, unknown> | { role?: unknown } })?.metadata;
  if (!metadata) {
    return undefined;
  }
  const role = metadata instanceof Map ? metadata.get('role') : metadata.role;
  return typeof role === 'string' ? role : undefined;
}

/** Retrieves and validates a user invite by encoded token and email. */
export async function getInvite(
  encodedToken: string,
  email: string,
  deps: InviteDeps,
): Promise<unknown> {
  try {
    const token = decodeURIComponent(encodedToken);
    const hash = await hashToken(token);
    const invite = await deps.findToken({ token: hash, email });

    if (!invite) {
      throw new Error('Invite not found or email does not match');
    }

    return invite;
  } catch (error) {
    logger.error('[getInvite] Error getting invite:', error);
    return { error: true, message: (error as Error).message };
  }
}
