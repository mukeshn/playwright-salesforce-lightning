import { type APIRequestContext, expect } from '@playwright/test';

export const API_VERSION = 'v60.0';
export const ORG = {
  username: 'qa.admin@crm.test',
  password: 'Sales#2026',
  securityToken: 'TKN123',
  clientId: 'connected-app-qa',
  clientSecret: 'c0nn3cted-s3cret',
};

export type SObject = 'Lead' | 'Account' | 'Contact' | 'Opportunity';
export interface SaveResult { id: string; success: boolean; errors: unknown[] }

/** Minimal Salesforce REST client: OAuth, sObject CRUD, SOQL and Composite. */
export class SalesforceApi {
  private token = '';
  constructor(private readonly request: APIRequestContext) {}

  async authenticate(): Promise<this> {
    const res = await this.request.post('/services/oauth2/token', {
      form: { grant_type: 'password', client_id: ORG.clientId, client_secret: ORG.clientSecret, username: ORG.username, password: ORG.password + ORG.securityToken },
    });
    expect(res, await res.text()).toBeOK();
    this.token = (await res.json()).access_token;
    return this;
  }

  get accessToken() { return this.token; }
  private get headers() { return { authorization: `Bearer ${this.token}` }; }
  private url(path: string) { return `/services/data/${API_VERSION}${path}`; }

  async create(type: SObject, fields: Record<string, unknown>): Promise<string> {
    const res = await this.request.post(this.url(`/sobjects/${type}`), { headers: this.headers, data: fields });
    expect(res.status(), await res.text()).toBe(201);
    return ((await res.json()) as SaveResult).id;
  }

  async get<T = Record<string, unknown>>(type: SObject, id: string): Promise<T> {
    const res = await this.request.get(this.url(`/sobjects/${type}/${id}`), { headers: this.headers });
    expect(res).toBeOK();
    return res.json();
  }

  raw(method: 'get' | 'post' | 'patch' | 'delete', path: string, data?: unknown) {
    return this.request[method](this.url(path), { headers: this.headers, data });
  }

  /** Custom Apex REST endpoint (/services/apexrest/...). */
  apex(path: string, data: unknown = {}) {
    return this.request.post(`/services/apexrest${path}`, { headers: this.headers, data });
  }

  async query<T = Record<string, unknown>>(soql: string): Promise<{ totalSize: number; records: T[] }> {
    const res = await this.request.get(this.url('/query'), { headers: this.headers, params: { q: soql } });
    expect(res, await res.text()).toBeOK();
    return res.json();
  }

  async delete(type: SObject, id: string) {
    const res = await this.request.delete(this.url(`/sobjects/${type}/${id}`), { headers: this.headers });
    expect(res.status()).toBe(204);
  }

  composite(allOrNone: boolean, compositeRequest: Array<{ method: string; url: string; referenceId: string; body?: unknown }>) {
    return this.request.post(this.url('/composite'), { headers: this.headers, data: { allOrNone, compositeRequest } });
  }
}

export const uniqueName = (prefix: string) => `${prefix} ${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 100)}`;
