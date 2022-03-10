import { resolve } from 'path';
import WebArchiver from './';

describe('Package', () => {
  it('works', async () => {
    const webArchiver = new WebArchiver();

    await webArchiver.launchBrowser();

    await webArchiver.run({
      urls: [
        'https://webscraper.io/test-sites/e-commerce/allinone',
      ],
      outDir: resolve(process.cwd(), './output'),
      recursive: true,
      maxRecursiveDepth: Infinity,
      allowNavigateAway: false,
      dryRun: true,
      blackListUrls: [],
    });

    await webArchiver.browser?.close();

    expect(true).toBe(true);
  });
});
