import { createInvite, getInviteRole } from './invite';

describe('createInvite', () => {
  function deps() {
    return {
      createToken: jest.fn().mockResolvedValue({}),
      findToken: jest.fn().mockResolvedValue(null),
    };
  }

  it('persists the role in token metadata when given', async () => {
    const d = deps();
    const token = await createInvite('new@example.com', d, 'ADMIN');

    expect(typeof token).toBe('string');
    expect(d.createToken).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', metadata: { role: 'ADMIN' } }),
    );
  });

  it('stores no metadata when no role is given', async () => {
    const d = deps();
    await createInvite('new@example.com', d);

    expect(d.createToken).toHaveBeenCalledWith(
      expect.not.objectContaining({ metadata: expect.anything() }),
    );
  });
});

describe('getInviteRole', () => {
  it('reads the role from a Mongoose Map metadata', () => {
    const invite = { metadata: new Map<string, unknown>([['role', 'ADMIN']]) };
    expect(getInviteRole(invite)).toBe('ADMIN');
  });

  it('reads the role from a plain-object metadata', () => {
    expect(getInviteRole({ metadata: { role: 'USER' } })).toBe('USER');
  });

  it('returns undefined when the invite carries no role', () => {
    expect(getInviteRole({ metadata: new Map() })).toBeUndefined();
    expect(getInviteRole({})).toBeUndefined();
    expect(getInviteRole(null)).toBeUndefined();
  });
});
