import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const setListMember =
  jest.fn<(listId: string, subscriberHash: string, payload: unknown) => Promise<void>>();
const updateListMemberTags =
  jest.fn<(listId: string, subscriberHash: string, payload: unknown) => Promise<void>>();

jest.unstable_mockModule('@mailchimp/mailchimp_marketing', () => ({
  default: {
    lists: {
      setListMember,
      updateListMemberTags,
    },
  },
}));

jest.unstable_mockModule('../logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('addSubscriber', () => {
  beforeEach(() => {
    process.env.DISABLE_MAILCHIMP_SYNC = 'false';
    process.env.MAILCHIMP_LIST_ID = 'test-list-id';
    setListMember.mockResolvedValue(undefined);
    updateListMemberTags.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.DISABLE_MAILCHIMP_SYNC;
    delete process.env.MAILCHIMP_LIST_ID;
    jest.clearAllMocks();
  });

  it('subscribes existing archived members during website signup', async () => {
    const { addSubscriber } = await import('./mailchimp.js');

    await addSubscriber('jdoe@stern.nyu.edu', 'John', 'Doe');

    expect(setListMember).toHaveBeenCalledWith('test-list-id', expect.any(String), {
      email_address: 'jdoe@stern.nyu.edu',
      status: 'subscribed',
      status_if_new: 'subscribed',
      merge_fields: {
        FNAME: 'John',
        LNAME: 'Doe',
        MMERGE6: 'John Doe',
      },
    });
  });

  it('skips external sync when Mailchimp is disabled', async () => {
    process.env.DISABLE_MAILCHIMP_SYNC = 'true';
    const { addSubscriber, removeSubscriber, testMailchimpConnection } =
      await import('./mailchimp.js');

    await addSubscriber('jdoe@stern.nyu.edu', 'John', 'Doe');
    await removeSubscriber('jdoe@stern.nyu.edu');
    await testMailchimpConnection();

    expect(setListMember).not.toHaveBeenCalled();
    expect(updateListMemberTags).not.toHaveBeenCalled();
  });
});
