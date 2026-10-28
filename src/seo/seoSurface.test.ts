import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { renderSeoHtml, seoPageForPath } from '../server/seoSurface';

test('public search surface exposes crawl controls, canonical identity, and structured data', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const robots = fs.readFileSync('public/robots.txt', 'utf8');
  const sitemap = fs.readFileSync('public/sitemap.xml', 'utf8');
  const llms = fs.readFileSync('public/llms.txt', 'utf8');

  assert.match(html, /<link rel="canonical" href="https:\/\/openpolici\.com\/"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type": "Organization"/);
  assert.match(html, /"@type": "WebSite"/);
  assert.match(html, /"@type": "Service"/);
  assert.match(robots, /Sitemap: https:\/\/openpolici\.com\/sitemap\.xml/);
  for (const privatePath of ['/api/', '/account', '/provider-account', '/admin']) {
    assert.match(robots, new RegExp(`Disallow: ${privatePath.replace('/', '\\/')}`));
  }
  for (const publicUrl of ['https://openpolici.com/', 'https://openpolici.com/consumers', 'https://openpolici.com/providers', 'https://openpolici.com/about', 'https://openpolici.com/insurance-comparison']) {
    assert.ok(sitemap.includes(`<loc>${publicUrl}</loc>`));
  }
  assert.match(llms, /consumer-controlled insurance marketplace/i);
  assert.doesNotMatch(llms, /\$35|VPO_ENGAGED/);
});

test('public pages receive unique canonical metadata while account surfaces fail closed to noindex', () => {
  const template = fs.readFileSync('index.html', 'utf8');
  const consumer = renderSeoHtml(template, '/consumers');
  const provider = renderSeoHtml(template, '/providers');
  const account = renderSeoHtml(template, '/account');
  assert.match(consumer, /<title>Compare Insurance Offers Privately \| Open Polici<\/title>/);
  assert.match(consumer, /rel="canonical" href="https:\/\/openpolici\.com\/consumers"/);
  assert.match(provider, /<title>Insurance Provider and Carrier Marketplace \| Open Polici<\/title>/);
  assert.match(provider, /rel="canonical" href="https:\/\/openpolici\.com\/providers"/);
  assert.match(account, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.equal(seoPageForPath('/admin').index, false);
});

test('public education routes receive unique indexable metadata and structured data', () => {
  const template = fs.readFileSync('index.html', 'utf8');
  const about = renderSeoHtml(template, '/about');
  const comparison = renderSeoHtml(template, '/insurance-comparison');
  assert.match(about, /<title>About Open Polici/);
  assert.match(about, /AboutPage/);
  assert.match(comparison, /<title>Open Polici vs Insurance Lead Generation/);
  assert.match(comparison, /application\/ld\+json/);
  assert.doesNotMatch(comparison, /noindex,nofollow/);
});
