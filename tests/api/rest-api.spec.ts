import { test, expect } from '../../src/fixtures/test';
import { API_VERSION, ORG, uniqueName } from '../../src/api/SalesforceApi';

test.describe('Salesforce REST API', { tag: '@api' }, () => {
  test('OAuth password flow requires the security token', async ({ request }) => {
    const withoutToken = await request.post('/services/oauth2/token', { form: { grant_type: 'password', username: ORG.username, password: ORG.password } });
    expect(withoutToken.status()).toBe(400);
    expect(await withoutToken.json()).toEqual({ error: 'invalid_grant', error_description: 'authentication failure' });
  });

  test('token response contains instance_url and identity', async ({ request }) => {
    const res = await request.post('/services/oauth2/token', { form: { grant_type: 'client_credentials', client_id: ORG.clientId, client_secret: ORG.clientSecret } });
    const body = await res.json();
    expect(body).toEqual(expect.objectContaining({ token_type: 'Bearer', access_token: expect.stringContaining('!'), instance_url: expect.stringMatching(/^http/) }));
  });

  test('requests without a session get INVALID_SESSION_ID', async ({ request }) => {
    const res = await request.get(`/services/data/${API_VERSION}/query`, { params: { q: 'SELECT Id FROM Lead' } });
    expect(res.status()).toBe(401);
    expect((await res.json())[0].errorCode).toBe('INVALID_SESSION_ID');
  });

  test('create, read, update and delete a Lead', async ({ sf }) => {
    const company = uniqueName('CRUD GmbH');
    const id = await sf.create('Lead', { LastName: 'Api', Company: company });
    expect((await sf.get('Lead', id))).toMatchObject({ attributes: { type: 'Lead' }, Company: company, Status: 'Open - Not Contacted' });

    const patch = await sf.raw('patch', `/sobjects/Lead/${id}`, { Status: 'Working - Contacted' });
    expect(patch.status()).toBe(204);
    expect((await sf.get<{ Status: string }>('Lead', id)).Status).toBe('Working - Contacted');

    await sf.delete('Lead', id);
    const gone = await sf.raw('get', `/sobjects/Lead/${id}`);
    expect(gone.status()).toBe(404);
  });

  test('missing required fields return REQUIRED_FIELD_MISSING', async ({ sf }) => {
    const res = await sf.raw('post', '/sobjects/Opportunity', { Name: 'No stage' });
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual([{ message: 'Required fields are missing: [StageName, CloseDate]', errorCode: 'REQUIRED_FIELD_MISSING', fields: ['StageName', 'CloseDate'] }]);
  });

  test('restricted picklist rejects unknown stages', async ({ sf }) => {
    const res = await sf.raw('post', '/sobjects/Opportunity', { Name: 'Bad', StageName: 'Maybe', CloseDate: '2027-01-01' });
    expect((await res.json())[0].errorCode).toBe('INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST');
  });

  test('SOQL with WHERE, ORDER BY and LIMIT', async ({ sf }) => {
    const res = await sf.query<{ Name: string; Amount: number }>("SELECT Id, Name, Amount FROM Opportunity WHERE Name LIKE 'Isar Outdoor%' ORDER BY Amount DESC LIMIT 2");
    expect(res.records.map((r) => r.Amount)).toEqual([48000, 12500]);
    expect(Object.keys(res.records[0])).toEqual(['attributes', 'Id', 'Name', 'Amount']);
  });

  test('malformed SOQL returns MALFORMED_QUERY', async ({ sf }) => {
    const res = await sf.raw('get', `/query?q=${encodeURIComponent('SELECT FROM WHERE')}`);
    expect(res.status()).toBe(400);
    expect((await res.json())[0].errorCode).toBe('MALFORMED_QUERY');
  });

  test('describe exposes required (non-nillable) fields', async ({ sf }) => {
    const res = await sf.raw('get', '/sobjects/Lead/describe');
    const required = (await res.json()).fields.filter((f: { nillable: boolean }) => !f.nillable).map((f: { name: string }) => f.name);
    expect(required).toEqual(['LastName', 'Company']);
  });
});

test.describe('Composite API', { tag: '@api' }, () => {
  test('creates Account and Contact in one call using a reference', async ({ sf, track }) => {
    const name = uniqueName('Composite AG');
    const res = await sf.composite(true, [
      { method: 'POST', url: `/services/data/${API_VERSION}/sobjects/Account`, referenceId: 'newAccount', body: { Name: name } },
      { method: 'POST', url: `/services/data/${API_VERSION}/sobjects/Contact`, referenceId: 'newContact', body: { LastName: 'Ref', AccountId: '@{newAccount.id}' } },
    ]);
    const { compositeResponse } = await res.json();
    expect(compositeResponse.map((r: { httpStatusCode: number }) => r.httpStatusCode)).toEqual([201, 201]);
    const [acc, con] = compositeResponse.map((r: { body: { id: string } }) => r.body.id);
    track('Contact', con);
    track('Account', acc);
    expect((await sf.get<{ AccountId: string }>('Contact', con)).AccountId).toBe(acc);
  });

  test('allOrNone rolls back every sub-request when one fails', async ({ sf }) => {
    const name = uniqueName('Rollback GmbH');
    const res = await sf.composite(true, [
      { method: 'POST', url: `/services/data/${API_VERSION}/sobjects/Account`, referenceId: 'acc', body: { Name: name } },
      { method: 'POST', url: `/services/data/${API_VERSION}/sobjects/Opportunity`, referenceId: 'opp', body: { Name: 'Broken', AccountId: '@{acc.id}' } },
    ]);
    const { compositeResponse } = await res.json();
    expect(compositeResponse[0].body[0].errorCode).toBe('PROCESSING_HALTED');
    expect(compositeResponse[1].body[0].errorCode).toBe('REQUIRED_FIELD_MISSING');
    expect((await sf.query(`SELECT Id FROM Account WHERE Name = '${name}'`)).totalSize).toBe(0);
  });

  test('without allOrNone successful sub-requests are kept', async ({ sf, track }) => {
    const name = uniqueName('Partial KG');
    const res = await sf.composite(false, [
      { method: 'POST', url: `/services/data/${API_VERSION}/sobjects/Account`, referenceId: 'acc', body: { Name: name } },
      { method: 'POST', url: `/services/data/${API_VERSION}/sobjects/Contact`, referenceId: 'bad', body: { FirstName: 'NoLastName' } },
    ]);
    const { compositeResponse } = await res.json();
    expect(compositeResponse.map((r: { httpStatusCode: number }) => r.httpStatusCode)).toEqual([201, 400]);
    track('Account', compositeResponse[0].body.id);
    expect((await sf.query(`SELECT Id FROM Account WHERE Name = '${name}'`)).totalSize).toBe(1);
  });
});
