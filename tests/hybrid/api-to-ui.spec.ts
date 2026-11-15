import { test, expect } from '../../src/fixtures/test';
import { uniqueName } from '../../src/api/SalesforceApi';

// Data is created through the REST API (fast, deterministic) and the UI is
// only used for what it is being tested for: rendering and user actions.
test.describe('API-seeded UI checks', () => {
  test('opportunity created via API appears in the list view with formatted amount', async ({ page, listView, sf, track }) => {
    const name = uniqueName('Seeded Deal');
    track('Opportunity', await sf.create('Opportunity', { Name: name, StageName: 'Needs Analysis', CloseDate: '2027-03-01', Amount: 15750.5 }));
    await listView.openObject('Opportunity');
    const row = listView.row(name);
    await expect(row.locator('td[data-field="StageName"]')).toHaveText('Needs Analysis');
    await expect(row.locator('td[data-field="Amount"]')).toHaveText('15.750,50 €');
    await row.getByRole('link', { name }).click();
    await expect(page).toHaveURL(/\/lightning\/r\/Opportunity\/006/);
  });

  test('UI edit is visible through SOQL immediately', async ({ page, listView, leadForm, sf, track }) => {
    const company = uniqueName('Sync Check');
    track('Lead', await sf.create('Lead', { LastName: 'Sync', Company: company }));
    await listView.openObject('Lead');
    await listView.rowAction(company, 'Edit');
    await leadForm.field('Email').fill('sync@check.example');
    await leadForm.save();
    await expect(page.locator('crm-toast').getByRole('alert')).toBeVisible();
    const { records } = await sf.query<{ Email: string }>(`SELECT Email FROM Lead WHERE Company = '${company}'`);
    expect(records[0].Email).toBe('sync@check.example');
  });
});
