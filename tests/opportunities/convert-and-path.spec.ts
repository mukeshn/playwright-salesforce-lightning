import { test, expect } from '../../src/fixtures/test';
import { uniqueName } from '../../src/api/SalesforceApi';

test.describe('Lead conversion and opportunity path', () => {
  test('converting a lead creates account, contact and opportunity', { tag: ['@smoke', '@e2e'] }, async ({ lightning, sf, track }) => {
    const company = uniqueName('Konvert Logistik');
    const leadId = await sf.create('Lead', { FirstName: 'Jan', LastName: 'Keller', Company: company, Email: 'jan@konvert.example' });
    track('Lead', leadId);

    await lightning.openRecord('Lead', leadId);
    await lightning.button('Convert').click();
    await lightning.expectToast('Your lead has been converted');
    await expect(lightning.page.locator('[data-record-name]')).toHaveText(`${company} - New Business`);

    const lead = await sf.get<Record<string, string | boolean>>('Lead', leadId);
    expect(lead).toMatchObject({ IsConverted: true, Status: 'Closed - Converted' });
    track('Opportunity', lead.ConvertedOpportunityId as string);
    track('Contact', lead.ConvertedContactId as string);
    track('Account', lead.ConvertedAccountId as string);

    const contacts = await sf.query<{ Email: string }>(`SELECT Id, Email FROM Contact WHERE AccountId = '${lead.ConvertedAccountId}'`);
    expect(contacts.records.map((c) => c.Email)).toEqual(['jan@konvert.example']);
  });

  test('converted lead no longer shows the Convert button', async ({ lightning, sf }) => {
    const leadId = await sf.create('Lead', { LastName: 'Done', Company: uniqueName('Already Converted') });
    expect(await sf.apex(`/LeadConvert/${leadId}`)).toBeOK();
    await lightning.openRecord('Lead', leadId);
    await expect(lightning.button('Convert')).toHaveCount(0);
    await expect(lightning.detail('IsConverted')).toHaveText('true');
  });

  test('moving an opportunity along the path', async ({ page, lightning, sf, track }) => {
    const id = await sf.create('Opportunity', { Name: uniqueName('Path Deal'), StageName: 'Qualification', CloseDate: '2027-01-31', Amount: 9000 });
    track('Opportunity', id);
    await lightning.openRecord('Opportunity', id);

    const path = page.getByRole('listbox', { name: 'Path' });
    await expect(path.getByRole('option', { selected: true })).toHaveText('Qualification');
    const mark = page.getByRole('button', { name: 'Mark as Current Stage' });
    await expect(mark).toBeDisabled();

    await path.getByRole('button', { name: 'Proposal/Price Quote' }).click();
    await mark.click();
    await lightning.expectToast('Stage changed successfully.');
    await expect(path.getByRole('option', { selected: true })).toHaveText('Proposal/Price Quote');
    expect((await sf.get<{ StageName: string }>('Opportunity', id)).StageName).toBe('Proposal/Price Quote');
  });
});
