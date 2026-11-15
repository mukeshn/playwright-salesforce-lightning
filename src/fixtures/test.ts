import { test as base, expect } from '@playwright/test';
import { SalesforceApi } from '../api/SalesforceApi';
import { ListViewPage } from '../pages/ListViewPage';
import { LeadForm } from '../pages/LeadForm';
import { LightningPage } from '../pages/LightningPage';

type Fixtures = {
  sf: SalesforceApi;
  lightning: LightningPage;
  listView: ListViewPage;
  leadForm: LeadForm;
  /** Records created through `track()` are deleted after the test, pass or fail. */
  track: (type: 'Lead' | 'Account' | 'Contact' | 'Opportunity', id: string) => void;
};

export const test = base.extend<Fixtures>({
  sf: async ({ request }, use) => use(await new SalesforceApi(request).authenticate()),

  // Frontdoor-style login: reuse an API session id instead of typing credentials in every test.
  page: async ({ page, request }, use) => {
    const res = await request.post('/crm/api/login', { data: { username: 'qa.admin@crm.test', password: 'Sales#2026' } });
    const { sessionId } = await res.json();
    await page.addInitScript((sid) => sessionStorage.setItem('sid', sid), sessionId);
    await use(page);
  },
  lightning: async ({ page }, use) => use(new LightningPage(page)),
  listView: async ({ page }, use) => use(new ListViewPage(page)),
  leadForm: async ({ page }, use) => use(new LeadForm(page)),

  track: async ({ sf }, use) => {
    const created: Array<[Parameters<Fixtures['track']>[0], string]> = [];
    await use((type, id) => created.push([type, id]));
    for (const [type, id] of created.reverse()) {
      await sf.raw('delete', `/sobjects/${type}/${id}`);
    }
  },
});

export { expect };
