import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startFixture } from './fixtures/server.js';

let fx, client;
before(async () => {
  fx = await startFixture();
  client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: ['src/mcp/server.js'],
    env: { ...process.env, REA_SEO_DELAY_MS: '0' },
  }));
});
after(async () => { await client.close(); fx.srv.close(); });

test('MCP: lista las 5 herramientas', async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['compare_competitors', 'compare_raw_vs_rendered', 'extract_programmatic_patterns', 'inspect_seo_architecture', 'reverse_engineer_serp_winner']);
});

test('MCP: extract_programmatic_patterns', async () => {
  const r = await client.callTool({ name: 'extract_programmatic_patterns', arguments: { domain: fx.base } });
  const data = JSON.parse(r.content[0].text);
  assert.equal(data.totals.urls, 58);
  assert.equal(data.templates[0].programmaticSignal, true);
});

test('MCP: inspect_seo_architecture', async () => {
  const r = await client.callTool({ name: 'inspect_seo_architecture', arguments: { url: fx.base + '/', maxPages: 5 } });
  const data = JSON.parse(r.content[0].text);
  assert.equal(data.signals.headingCounts.h1, 1);
  assert.ok(data.crawl.crawled >= 1);
});
