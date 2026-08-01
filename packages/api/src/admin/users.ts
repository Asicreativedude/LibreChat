import { Types } from 'mongoose';
import { PrincipalType, SystemRoles } from 'librechat-data-provider';
import { logger, isValidObjectIdString } from '@librechat/data-schemas';
import type {
  IUser,
  IRole,
  IConfig,
  AdminUserListItem,
  AdminUserSearchResult,
  UserDeleteResult,
} from '@librechat/data-schemas';
import type { FilterQuery } from 'mongoose';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import type { InviteDeps } from '~/auth';
import { parsePagination } from './pagination';
import { checkEmailConfig } from '~/utils';
import { createInvite } from '~/auth';

const MAX_SEARCH_LENGTH = 200;

const USER_LIST_FIELDS = '_id name username email avatar role provider createdAt updatedAt';

/** The invite email, rendered by `inviteUser.handlebars`. */
export interface InviteEmailParams {
  email: string;
  subject: string;
  payload: {
    appName: string;
    inviteLink: string;
    year: number;
    name: string;
  };
  template: string;
}

export interface AdminUsersDeps {
  findUsers: (
    searchCriteria: FilterQuery<IUser>,
    fieldsToSelect?: string | string[] | null,
    options?: { limit?: number; offset?: number; sort?: Record<string, 1 | -1> },
  ) => Promise<IUser[]>;
  countUsers: (filter?: FilterQuery<IUser>) => Promise<number>;
  /**
   * Thin data-layer delete — removes the User document only.
   * Full cascade of user-owned resources (conversations, messages, files, tokens, etc.)
   * is handled by `UserController.deleteUserController` in the self-delete flow.
   * This admin endpoint currently cascades Config and AclEntries.
   * A future iteration should consolidate the full cascade into a shared service function.
   */
  deleteUserById: (userId: string) => Promise<UserDeleteResult>;
  deleteConfig: (
    principalType: PrincipalType,
    principalId: string | Types.ObjectId,
  ) => Promise<IConfig | null>;
  deleteAclEntries: (filter: {
    principalType: PrincipalType;
    principalId: string | Types.ObjectId;
  }) => Promise<void>;
  /** Token persistence for the invite (mirrors `checkInviteUser`'s deps). */
  createToken: InviteDeps['createToken'];
  findToken: InviteDeps['findToken'];
  /** Role lookup — validates the invite's intended role against existing roles. */
  getRoleByName: (roleName: string) => Promise<IRole | null>;
  /** Nodemailer/Mailgun send — api-side, injected. */
  sendEmail: (params: InviteEmailParams) => Promise<unknown>;
}

export function createAdminUsersHandlers(deps: AdminUsersDeps): {
  listUsers: (req: ServerRequest, res: Response) => Promise<Response>;
  searchUsers: (req: ServerRequest, res: Response) => Promise<Response>;
  deleteUser: (req: ServerRequest, res: Response) => Promise<Response>;
  inviteUser: (req: ServerRequest, res: Response) => Promise<Response>;
} {
  const {
    findUsers,
    countUsers,
    deleteUserById,
    deleteConfig,
    deleteAclEntries,
    createToken,
    findToken,
    getRoleByName,
    sendEmail,
  } = deps;

  async function inviteUserHandler(req: ServerRequest, res: Response) {
    try {
      const { email: rawEmail, role: rawRole } = req.body as { email?: string; role?: string };
      const email = typeof rawEmail === 'string' ? rawEmail.trim() : '';
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'A valid email address is required' });
      }

      const role = typeof rawRole === 'string' && rawRole.trim() ? rawRole.trim() : 'USER';
      if (!(await getRoleByName(role))) {
        return res.status(400).json({ error: `Unknown role: ${role}` });
      }

      if (!checkEmailConfig()) {
        return res.status(503).json({ error: 'Email service is not configured' });
      }

      const [existing] = await findUsers({ email }, '_id', { limit: 1 });
      if (existing) {
        return res.status(409).json({ error: 'A user with that email already exists' });
      }

      const token = await createInvite(email, { createToken, findToken }, role);
      if (typeof token !== 'string') {
        return res.status(500).json({ error: 'Failed to create invite' });
      }

      const appName = process.env.APP_TITLE || 'LibreChat';
      const inviteLink = `${process.env.DOMAIN_CLIENT}/register?token=${token}`;
      await sendEmail({
        email,
        subject: `Invite to join ${appName}!`,
        payload: { appName, inviteLink, year: new Date().getFullYear(), name: email },
        template: 'inviteUser.handlebars',
      });

      return res.status(201).json({ email, message: 'Invitation sent' });
    } catch (error) {
      logger.error('[adminUsers] inviteUser error:', error);
      return res.status(500).json({ error: 'Failed to send invitation' });
    }
  }

  async function listUsersHandler(req: ServerRequest, res: Response) {
    try {
      const { limit, offset } = parsePagination(req.query);
      const [users, total] = await Promise.all([
        findUsers({}, USER_LIST_FIELDS, { limit, offset, sort: { createdAt: -1 } }),
        countUsers(),
      ]);

      const mapped: AdminUserListItem[] = users.map((u) => ({
        id: u._id?.toString() ?? '',
        name: u.name ?? '',
        username: u.username ?? '',
        email: u.email ?? '',
        avatar: u.avatar ?? '',
        role: u.role ?? 'USER',
        provider: u.provider ?? 'local',
        createdAt: u.createdAt?.toISOString(),
        updatedAt: u.updatedAt?.toISOString(),
      }));

      return res.status(200).json({ users: mapped, total, limit, offset });
    } catch (error) {
      logger.error('[adminUsers] listUsers error:', error);
      return res.status(500).json({ error: 'Failed to list users' });
    }
  }

  async function searchUsersHandler(req: ServerRequest, res: Response) {
    try {
      const rawQ = req.query.q;
      const rawLimit = req.query.limit;
      const query = typeof rawQ === 'string' ? rawQ : undefined;
      const limitStr = typeof rawLimit === 'string' ? rawLimit : '20';
      const trimmed = query?.trim() ?? '';

      if (!trimmed) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      if (trimmed.length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters' });
      }

      if (trimmed.length > MAX_SEARCH_LENGTH) {
        return res
          .status(400)
          .json({ error: `Query must not exceed ${MAX_SEARCH_LENGTH} characters` });
      }

      const searchLimit = Math.min(Math.max(1, parseInt(limitStr, 10) || 20), 50);
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}`, 'i');

      const users = await findUsers(
        { $or: [{ name: regex }, { email: regex }, { username: regex }] },
        '_id name email username avatar',
        { limit: searchLimit, sort: { name: 1 } },
      );

      const results: AdminUserSearchResult[] = users.map((u) => ({
        id: u._id?.toString() ?? '',
        name: u.name ?? '',
        email: u.email ?? '',
        username: u.username,
        avatarUrl: u.avatar,
      }));

      return res
        .status(200)
        .json({ users: results, total: results.length, capped: results.length >= searchLimit });
    } catch (error) {
      logger.error('[adminUsers] searchUsers error:', error);
      return res.status(500).json({ error: 'Failed to search users' });
    }
  }

  async function deleteUserHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };

      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      const callerId = req.user?._id?.toString() ?? req.user?.id;
      if (callerId === id) {
        return res.status(403).json({ error: 'Cannot delete your own account' });
      }

      const [targetUser] = await findUsers({ _id: id }, 'role', { limit: 1 });
      if (targetUser?.role === SystemRoles.ADMIN) {
        const adminCount = await countUsers({ role: SystemRoles.ADMIN });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }
      }

      const result = await deleteUserById(id);

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (targetUser?.role === SystemRoles.ADMIN) {
        const remaining = await countUsers({ role: SystemRoles.ADMIN });
        if (remaining === 0) {
          logger.error(
            `[adminUsers] CRITICAL: last admin deleted via race condition, user: ${id}. ` +
              'Manual DB intervention required to restore an ADMIN user.',
          );
        }
      }

      const objectId = new Types.ObjectId(id);
      const cleanupResults = await Promise.allSettled([
        deleteConfig(PrincipalType.USER, id),
        deleteAclEntries({ principalType: PrincipalType.USER, principalId: objectId }),
      ]);
      for (const r of cleanupResults) {
        if (r.status === 'rejected') {
          logger.error('[adminUsers] cascade cleanup failed for user:', id, r.reason);
        }
      }

      return res.status(200).json({ message: result.message || 'User deleted successfully' });
    } catch (error) {
      logger.error('[adminUsers] deleteUser error:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  return {
    listUsers: listUsersHandler,
    searchUsers: searchUsersHandler,
    deleteUser: deleteUserHandler,
    inviteUser: inviteUserHandler,
  };
}
