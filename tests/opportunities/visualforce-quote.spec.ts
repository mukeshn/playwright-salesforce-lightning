import { test, expect } from '../../src/fixtures/test';
import { uniqueName } from '../../src/api/SalesforceApi';

// Classic Visualforce pages are still embedded in many Lightning orgs.
// They render inside an iframe with generated ids like "j_id0:quoteForm:discount".
test.describe('Visualforce quote calculator (iframe)', () => {
  let oppId: string;

  test.beforeEach(async ({ lightning, sf, track }) => {
    oppId = await sf.create('Opportunity', { Name: uniqueName('VF Quote'), StageName: 'Proposal/Price Quote', CloseDate: '2027-02-15', Amount: 1200 });
    track('Opportunity', oppId);
    await lightning.openRecord('Opportunity', oppId);
  });

  test('pre-fills list price from the opportunity amount and calculates net', async ({ page }) => {
    const vf = page.frameLocator('iframe[title="Quote Calculator"]');
    await expect(vf.getByLabel('List price (EUR)')).toHaveValue('1200');
    await vf.getByLabel('Quantity').fill('3');
    await vf.getByLabel('Discount (%)').fill('15');
    await vf.getByRole('button', { name: 'Calculate' }).click();
    await expect(vf.locator('[id="j_id0:quoteForm:netTotal"]')).toHaveText('3.060,00 €');
  });

  test('discount above 30% requires approval', async ({ page }) => {
    const vf = page.frameLocator('iframe[title="Quote Calculator"]');
    await vf.getByLabel('Discount (%)').fill('35');
    await vf.getByRole('button', { name: 'Calculate' }).click();
    await expect(vf.getByRole('alert')).toHaveText('Error: Discounts above 30% require approval.');
    await expect(vf.locator('[id="j_id0:quoteForm:netTotal"]')).toBeEmpty();
  });

  test('frame is addressable by name as well as by locator', async ({ page }) => {
    await expect(page.locator('iframe[name="vfFrame0"]')).toBeVisible();
    const frame = page.frame({ name: 'vfFrame0' });
    expect(frame).not.toBeNull();
    await frame!.waitForLoadState();
    expect(frame!.url()).toContain('/crm/vf/quote.html?amount=1200');
  });
});
