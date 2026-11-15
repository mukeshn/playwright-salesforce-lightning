import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Shared Lightning Experience helpers. Every component here lives in an open
 * shadow root (as LWC base components do); Playwright's role/label/CSS engines
 * pierce shadow DOM, so no special handling is needed - one of the main
 * reasons Playwright fits Salesforce UIs well.
 */
export class LightningPage {
  readonly toast: Locator;
  readonly modal: Locator;

  constructor(readonly page: Page) {
    this.toast = page.locator('crm-toast').getByRole('alert');
    this.modal = page.getByRole('dialog');
  }

  async openObject(type: 'Lead' | 'Opportunity' | 'Account') {
    await this.page.goto(`/crm/index.html#/lightning/o/${type}/list`);
    await expect(this.page.getByRole('grid')).toBeVisible();
  }

  async openRecord(type: 'Lead' | 'Opportunity' | 'Account', id: string) {
    await this.page.goto(`/crm/index.html#/lightning/r/${type}/${id}/view`);
    await expect(this.page.locator('[data-record-name]')).toBeVisible();
  }

  globalNav(label: string) {
    return this.page.getByRole('navigation', { name: 'Global' }).getByRole('link', { name: label });
  }

  /** lightning-input / lightning-combobox by its visible label (works through the shadow boundary). */
  field(label: string) {
    return this.page.getByLabel(label, { exact: true });
  }

  async selectCombobox(label: string, option: string) {
    await this.page.getByRole('combobox', { name: label }).click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
    await expect(this.page.getByRole('combobox', { name: label })).toHaveText(option);
  }

  button(label: string) {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  async expectToast(message: string | RegExp) {
    await expect(this.toast).toBeVisible();
    await expect(this.toast).toContainText(message);
  }

  detail(field: string) {
    return this.page.locator(`dd[data-field="${field}"]`);
  }

  recordIdFromUrl(): string {
    const m = this.page.url().match(/\/lightning\/r\/\w+\/(\w+)\/view/);
    if (!m) throw new Error(`Not on a record page: ${this.page.url()}`);
    return m[1];
  }
}
