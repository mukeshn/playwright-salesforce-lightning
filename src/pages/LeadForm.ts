import { expect } from '@playwright/test';
import { LightningPage } from './LightningPage';

export interface LeadInput {
  firstName?: string;
  lastName?: string;
  company?: string;
  email?: string;
  status?: 'Open - Not Contacted' | 'Working - Contacted' | 'Closed - Not Converted';
}

export class LeadForm extends LightningPage {
  async fill(lead: LeadInput) {
    await expect(this.modal).toBeVisible();
    if (lead.firstName !== undefined) await this.field('First Name').fill(lead.firstName);
    if (lead.lastName !== undefined) await this.field('* Last Name').fill(lead.lastName);
    if (lead.company !== undefined) await this.field('* Company').fill(lead.company);
    if (lead.email !== undefined) await this.field('Email').fill(lead.email);
    if (lead.status) await this.selectCombobox('Lead Status', lead.status);
  }

  async save() {
    await this.modal.getByRole('button', { name: 'Save' }).click();
  }

  fieldError(label: string) {
    return this.modal.locator('lightning-input').filter({ has: this.page.getByLabel(label, { exact: true }) }).getByRole('alert');
  }

  get formError() {
    return this.modal.locator('[data-form-errors]');
  }
}
