import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PrincipalType, SystemRoles } from 'librechat-data-provider';
import { createModels, createMethods, SystemCapabilities } from '@librechat/data-schemas';
import type { AllMethods } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { createAdminGrantsHandlers } from './grants';

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

let mongoServer: MongoMemoryServer;
let methods: AllMethods;

function buildHandlers() {
  return createAdminGrantsHandlers({
    listGrants: methods.listGrants,
    countGrants: methods.countGrants,
    getCapabilitiesForPrincipal: methods.getCapabilitiesForPrincipal,
    getCapabilitiesForPrincipals: methods.getCapabilitiesForPrincipals,
    grantCapability: methods.grantCapability,
    revokeCapability: methods.revokeCapability,
    getUserPrincipals: methods.getUserPrincipals,
    hasCapabilityForPrincipals: methods.hasCapabilityForPrincipals,
    getHeldCapabilities: methods.getHeldCapabilities,
    checkUserExists: async (userId: string) => (await methods.getUserById(userId, '_id')) != null,
  });
}

function createReqRes(overrides: {
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  user: { _id: Types.ObjectId; role: string };
}) {
  const req = {
    params: overrides.params ?? {},
    query: {},
    body: overrides.body ?? {},
    user: overrides.user,
  } as unknown as ServerRequest;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { req, res, status, json };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  createModels(mongoose);
  methods = createMethods(mongoose);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('admin grants — USER principal round-trip (real MongoDB)', () => {
  let admin: { _id: Types.ObjectId; role: string };
  let target: { _id: Types.ObjectId; role: string };

  beforeEach(async () => {
    const User = mongoose.models.User;
    const adminDoc = await User.create({
      name: 'Admin',
      email: 'admin@test.com',
      password: 'password123',
      provider: 'local',
      role: SystemRoles.ADMIN,
    });
    admin = { _id: adminDoc._id, role: SystemRoles.ADMIN };

    const targetDoc = await User.create({
      name: 'Target',
      email: 'target@test.com',
      password: 'password123',
      provider: 'local',
      role: SystemRoles.USER,
    });
    target = { _id: targetDoc._id, role: SystemRoles.USER };

    await methods.seedSystemGrants();
  });

  it('grant → appears in GET → enforcement honors it → revoke → gone', async () => {
    const handlers = buildHandlers();
    const targetId = target._id.toString();
    const targetPrincipals = await methods.getUserPrincipals({
      userId: targetId,
      role: target.role,
    });

    /** Before: target cannot read users. */
    expect(
      await methods.hasCapabilityForPrincipals({
        principals: targetPrincipals,
        capability: SystemCapabilities.READ_USERS,
      }),
    ).toBe(false);

    /** Grant read:users to the target user, gated by the admin's MANAGE_USERS. */
    const assign = createReqRes({
      body: {
        principalType: PrincipalType.USER,
        principalId: targetId,
        capability: SystemCapabilities.READ_USERS,
      },
      user: admin,
    });
    await handlers.assignGrant(assign.req, assign.res);
    expect(assign.status).toHaveBeenCalledWith(201);

    /** It shows up on GET /grants/user/:userId. */
    const get1 = createReqRes({
      params: { principalType: PrincipalType.USER, principalId: targetId },
      user: admin,
    });
    await handlers.getPrincipalGrants(get1.req, get1.res);
    expect(get1.status).toHaveBeenCalledWith(200);
    expect(get1.json.mock.calls[0][0].grants).toHaveLength(1);
    expect(get1.json.mock.calls[0][0].grants[0].capability).toBe(SystemCapabilities.READ_USERS);

    /** Money assertion: enforcement now honors the user-level grant. */
    expect(
      await methods.hasCapabilityForPrincipals({
        principals: targetPrincipals,
        capability: SystemCapabilities.READ_USERS,
      }),
    ).toBe(true);

    /** Revoke it. */
    const revoke = createReqRes({
      params: {
        principalType: PrincipalType.USER,
        principalId: targetId,
        capability: SystemCapabilities.READ_USERS,
      },
      user: admin,
    });
    await handlers.revokeGrant(revoke.req, revoke.res);
    expect(revoke.status).toHaveBeenCalledWith(200);

    /** Gone from GET and from enforcement. */
    const get2 = createReqRes({
      params: { principalType: PrincipalType.USER, principalId: targetId },
      user: admin,
    });
    await handlers.getPrincipalGrants(get2.req, get2.res);
    expect(get2.json.mock.calls[0][0].grants).toHaveLength(0);
    expect(
      await methods.hasCapabilityForPrincipals({
        principals: targetPrincipals,
        capability: SystemCapabilities.READ_USERS,
      }),
    ).toBe(false);
  });

  it('rejects a grant to a non-existent user with 400', async () => {
    const handlers = buildHandlers();
    const assign = createReqRes({
      body: {
        principalType: PrincipalType.USER,
        principalId: new Types.ObjectId().toString(),
        capability: SystemCapabilities.READ_USERS,
      },
      user: admin,
    });

    await handlers.assignGrant(assign.req, assign.res);

    expect(assign.status).toHaveBeenCalledWith(400);
    expect(assign.json).toHaveBeenCalledWith({ error: 'User not found' });
  });
});
