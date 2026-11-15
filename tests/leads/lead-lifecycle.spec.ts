import { test, expect } from '../../src/fixtures/test';
import { uniqueName } from '../../src/api/SalesforceApi';

test.describe('Leads', () => {
  test.beforeEach(async ({ listView }) => listView.openObject('Lead'));

  test('create a lead through the New modal', { tag: '@smoke' }, async ({ listView, leadForm, lightning, sf, track }) => {
    const company = uniqueName('Bergwerk Outdoor');
    await listView.clickNew();
    await leadForm.fill({ firstName: 'Clara', lastName: 'Hofmann', company, email: 'clara.hofmann@example.com', status: 'Working - Contacted' });
    await leadForm.save();

    await lightning.expectToast('Lead "Clara Hofmann" was created.');
    await expect(lightning.page.locator('[data-record-name]')).toHaveText('Clara Hofmann');
    const id = lightning.recordIdFromUrl();
    track('Lead', id);
    expect(id).toMatch(/^00Q[A-Za-z0-9]{15}$/);

    // The record really exists server-side with the chosen picklist value.
    const lead = await sf.get<{ Company: string; Status: string }>('Lead', id);
    expect(lead).toMatchObject({ Company: company, Status: 'Working - Contacted' });
  });

  test('required fields show inline errors and block save', async ({ listView, leadForm }) => {
    await listView.clickNew();
    await leadForm.save();
    await expect(leadForm.fieldError('* Last Name')).toHaveText('Complete this field.');
    await expect(leadForm.fieldError('* Company')).toHaveText('Complete this field.');
    await expect(leadForm.formError).toHaveText('We hit a snag. Review the errors on this page.');
    await expect(leadForm.modal).toBeVisible();
  });

  test('invalid email format is rejected client-side', async ({ listView, leadForm }) => {
    await listView.clickNew();
    await leadForm.fill({ lastName: 'Test', company: 'Test GmbH', email: 'not-an-email' });
    await leadForm.save();
    await expect(leadForm.fieldError('Email')).toHaveText('You have entered an invalid format.');
  });

  test('cancel closes the modal without creating anything', async ({ listView, leadForm, sf }) => {
    const company = uniqueName('Cancelled Co');
    await listView.clickNew();
    await leadForm.fill({ lastName: 'Nobody', company });
    await leadForm.button('Cancel').click();
    await expect(leadForm.modal).toBeHidden();
    expect((await sf.query(`SELECT Id FROM Lead WHERE Company = '${company}'`)).totalSize).toBe(0);
  });

  test('edit a lead from the row action menu', async ({ page, listView, leadForm, lightning, sf, track }) => {
    const company = uniqueName('Edit Me AG');
    track('Lead', await sf.create('Lead', { LastName: 'Editable', Company: company }));
    await page.reload();
    await listView.rowAction(company, 'Edit');
    await leadForm.selectCombobox('Lead Status', 'Closed - Not Converted');
    await leadForm.save();
    await lightning.expectToast('was saved.');
    await expect(listView.row(company).locator('td[data-field="Status"]')).toHaveText('Closed - Not Converted');
  });

  test('delete a lead from the row action menu', async ({ page, listView, lightning, sf }) => {
    const company = uniqueName('Delete Me KG');
    const id = await sf.create('Lead', { LastName: 'Temp', Company: company });
    await page.reload();
    await listView.rowAction(company, 'Delete');
    await lightning.expectToast('Lead "Temp" was deleted.');
    await expect(listView.row(company)).toHaveCount(0);
    expect((await sf.raw('get', `/sobjects/Lead/${id}`)).status()).toBe(404);
  });

  test('list search filters rows client-side', async ({ listView }) => {
    await listView.search('rossi');
    await expect(listView.rows).toHaveCount(1);
    await expect(listView.rows.first()).toContainText('Rossi Retail SpA');
  });

  test('sorting by Company toggles aria-sort', async ({ listView }) => {
    await listView.sortBy('Company');
    await expect(listView.grid.getByRole('columnheader', { name: 'Company' })).toHaveAttribute('aria-sort', 'ascending');
    const asc = await listView.columnValues('Company');
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    await listView.sortBy('Company');
    await expect(listView.grid.getByRole('columnheader', { name: 'Company' })).toHaveAttribute('aria-sort', 'descending');
  });
});
