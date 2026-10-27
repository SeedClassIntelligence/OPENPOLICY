const ORIGIN = 'https://openpolici.com';

type SeoPage = { title: string; description: string; canonical: string; index: boolean };

const PUBLIC_PAGES: Record<string, SeoPage> = {
  '/': {
    title: 'Open Polici | Private Insurance Marketplace',
    description: 'Compare documented insurance offers privately. Review factual coverage and price differences, then choose which provider may contact you.',
    canonical: `${ORIGIN}/`, index: true
  },
  '/consumers': {
    title: 'Compare Insurance Offers Privately | Open Polici',
    description: 'Upload an existing insurance policy or define a new coverage request, receive provider offers privately, and authorize contact only after you choose.',
    canonical: `${ORIGIN}/consumers`, index: true
  },
  '/providers': {
    title: 'Insurance Provider and Carrier Marketplace | Open Polici',
    description: 'Open Polici gives licensed insurance providers and carriers structured, consumer-initiated opportunities, documented competition tools, and governed authorized connections.',
    canonical: `${ORIGIN}/providers`, index: true
  },
  '/about': {
    title: 'About Open Polici | Consumer-Controlled Insurance Marketplace',
    description: 'Learn how Open Polici protects consumer privacy, supports factual insurance offer comparison, and connects consumers with eligible providers only after authorization.',
    canonical: `${ORIGIN}/about`, index: true
  },
  '/insurance-comparison': {
    title: 'How Insurance Offer Comparison Works | Open Polici',
    description: 'See how Open Polici compares insurance premiums, coverage limits, deductibles, inclusions, and unknowns against a consumer-controlled baseline.',
    canonical: `${ORIGIN}/insurance-comparison`, index: true
  }
};

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function seoPageForPath(pathname: string): SeoPage {
  return PUBLIC_PAGES[pathname] || {
    title: 'Secure Account | Open Polici',
    description: 'Secure Open Polici account workspace.',
    canonical: `${ORIGIN}/`, index: false
  };
}

export function renderSeoHtml(template: string, pathname: string): string {
  const page = seoPageForPath(pathname);
  const title = escapeAttribute(page.title);
  const description = escapeAttribute(page.description);
  const canonical = escapeAttribute(page.canonical);
  const robots = page.index ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow,noarchive';
  const structuredData = pathname === '/about'
    ? { '@context': 'https://schema.org', '@type': 'AboutPage', name: page.title, url: page.canonical, description: page.description, isPartOf: { '@type': 'WebSite', name: 'Open Polici', url: ORIGIN } }
    : pathname === '/insurance-comparison'
    ? { '@context': 'https://schema.org', '@type': 'Article', headline: 'How Open Polici Compares Insurance Offers', description: page.description, mainEntityOfPage: page.canonical, publisher: { '@type': 'Organization', name: 'Open Polici', url: ORIGIN } }
    : null;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/>/, `<meta name="robots" content="${robots}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${description}" />`);
  if (structuredData) html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>\n</head>`);
  return html;
}
