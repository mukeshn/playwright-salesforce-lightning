import { type Locator, expect } from '@playwright/test';
import { LightningPage } from './LightningPage';

export class ListViewPage extends LightningPage {
  get grid(): Locator {
    return this.page.getByRole('grid');
  }

  get rows(): Locator {
    return this.grid.locator('tbody tr');
  }

  row(text: string): Locator {
    return this.rows.filter({ hasText: text });
  }

  async search(term: string) {
    await this.page.getByRole('searchbox', { name: 'Search this list' }).fill(term);
  }

  async sortBy(column: string) {
    await this.grid.getByRole('columnheader', { name: column }).click();
  }

  columnValues(field: string) {
    return this.grid.locator(`td[data-field="${field}"]`).allInnerTexts();
  }

  async rowAction(rowText: string, action: 'Edit' | 'Delete') {
    const row = this.row(rowText);
    await row.getByRole('button', { name: 'Show actions' }).click();
    await row.getByRole('menuitem', { name: action }).click();
  }

  async clickNew() {
    await this.button('New').click();
    await expect(this.modal).toBeVisible();
  }
}
