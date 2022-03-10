// @ts-ignore
import { version } from '../package.json';

import { resolve } from 'path';
import {
  mkdirSync,
  rmdirSync,
  writeFileSync,
} from 'fs';
import { URL } from 'url';

import MonoContext from '@simplyhexagonal/mono-context';
import Logger from '@simplyhexagonal/logger';
import { multiReplaceSync } from '@simplyhexagonal/multi-replace';
import puppeteer, {
  Browser,
  Page,
} from 'puppeteer';

export interface WebArchiverRunOptions {
  dryRun?: boolean;
  urls: string[];
  outDir: string;
  recursive: boolean;
  maxRecursiveDepth: number;
  allowNavigateAway?: boolean;
  blackListUrls?: string[];
}

export const UTF_RESOURCE_TYPES = [
  'document',
  'stylesheet',
  'script',
];

class WebArchiver {
  static version = version;

  logger: Logger;
  browser?: Browser;
  page?: Page;

  constructor() {
    const { webArchiverInstance, logger } = MonoContext.getState();

    this.logger = logger || new Logger({});

    if (webArchiverInstance) {
      return webArchiverInstance;
    }
  }

  async launchBrowser() {
    const { logger } = this;

    logger.debug('Launching browser...');

    logger.time('Launched browser in');

    this.browser = await puppeteer.launch({ headless: true });

    const page = await this.browser.newPage();

    await page.setRequestInterception(true);

    this.page = page;

    logger.timeEnd('Launched browser in');
  }

  async run({
    dryRun,
    urls,
    outDir,
    recursive,
    maxRecursiveDepth,
    allowNavigateAway,
    blackListUrls,
  }: WebArchiverRunOptions) {
    const {
      logger,
      page,
    } = this;

    if (!dryRun) {
      try {
        mkdirSync(outDir, { recursive: true });
      } catch (e: any) {
        if (e.code !== 'EEXIST') {
          await logger.error(e);

          throw e;
        } else {
          logger.warn('Output directory already exists');
        }
      }
    }

    if (page) {
      const hosts = urls.map((url) => (new URL(url)).host);
      const resourceTypeMap: any = {};
      const filesToDownload: string[] = [];
      const filesAlreadyDownloaded: string[] = [];
      const processedUrls: string[] = [];
      let currentRecursionDepth = 0;

      await logger.info(`Running Web Archiver ${WebArchiver.version}`);

      await logger.info(`Given urls:\n\n${urls.join('\n')}`);

      if (!dryRun) {
        await logger.info(`Creating output directories...`);

        await hosts.reduce(async (a, host) => {
            await a;

            try {
              rmdirSync(resolve(outDir, host), { recursive: true });
              mkdirSync(resolve(outDir, host), { recursive: true });
            } catch (e: any) {
              await logger.warn(e);
            }

            return Promise.resolve();
          },
          Promise.resolve(),
        );

        await logger.info(`Done creating output directories.`);
      }

      page.on('request', (interceptedRequest) => {
        const u = interceptedRequest.url();
        const url = new URL(u);

        if (
          !(blackListUrls || []).includes(u)
          && (
            allowNavigateAway || hosts.includes(url.host)
          )
        ) {
          const resourceType = interceptedRequest.resourceType();

          const outFilePath = resolve(
            outDir,
            url.host,
            url.pathname.replace(/^\//, ''),
          );

          if (!filesAlreadyDownloaded.includes(outFilePath)) {
            filesToDownload.push(outFilePath);

            resourceTypeMap[outFilePath] = resourceType;
          }
        }

        interceptedRequest.continue();
      });

      page.on('response', async (interceptedResponse) => {
        const url = new URL(interceptedResponse.url());

        const {
          'content-type': contentType,
        } = interceptedResponse.headers();

        let outFilePath = resolve(
          outDir,
          url.host,
          url.pathname.replace(/^\//, ''),
        );

        if (
          filesToDownload.includes(outFilePath)
          && !filesAlreadyDownloaded.includes(outFilePath)
        ) {
          filesAlreadyDownloaded.push(outFilePath);

          if (!dryRun) {
            const resourceType = resourceTypeMap[outFilePath];

            if (resourceType === 'document' && contentType.includes('text/html')) {
              outFilePath = multiReplaceSync(
                outFilePath,
                [
                  [new RegExp(`\/output\/${url.host}$`), `/output/${url.host}/index.html`],
                  [/\/([^\/\.]*?)$/, '/$1/index.html'],
                ],
              );
            }

            await logger.debug(`Saving: ${outFilePath}`);

            const encoding = (
              UTF_RESOURCE_TYPES.includes(resourceTypeMap[outFilePath])
            ) ? (
              'utf8'
            ) : (
              'binary'
            );

            const outFileDir = outFilePath.replace(/\/[^\/]*?$/, '');

            try {
              mkdirSync(outFileDir, { recursive: true });
            } catch (e: any) {
              if (e.code !== 'EEXIST') {
                await logger.error(e);

                throw e;
              }
            }

            const content = await interceptedResponse.buffer();

            writeFileSync(outFilePath, content, { encoding });
          }
        }

        if (!processedUrls.includes(`${url.host}${url.pathname}`)) {
          processedUrls.push(`${url.host}${url.pathname}`);
        }
      });

      let nextPages: string[] = [...urls];
      let nextRound: string[] = [];
      const processedPages: string[] = [];

      while (nextPages.length > 0) {
        const u = nextPages.shift() || '';

        const url = new URL(u);

        if (!processedUrls.includes(`${url.host}${url.pathname}`)) {
          await logger.info(`Visiting: ${u}`);

          processedUrls.push(`${url.host}${url.pathname}`);

          const result = await page.goto(u, {
            waitUntil: 'networkidle0',
          });

          processedPages.push(u);

          if (result.status() === 200) {
            const links = await page.$$('a');

            (await Promise.all<string>(
              (
                await Promise.all(
                  links.map((l) => l.getProperty('href'))
                )
              ).map((p) => p.jsonValue())
            )).filter(
              (l) => l && !(blackListUrls || []).includes(l)
            ).map(
              (l) => new URL(l)
            ).filter(
              (l) => {
                return (
                  !processedUrls.includes(`${l.host}${l.pathname}`)
                  && (
                    allowNavigateAway
                    || hosts.includes(l.host)
                  )
                );
              }
            ).forEach(
              (l) => {
                nextRound.push(`${l.protocol}//${l.host}${l.pathname}`)
              }
            );
          }
        }

        if (nextPages.length <= 1) {
          currentRecursionDepth += 1;

          if (recursive && currentRecursionDepth <= maxRecursiveDepth) {
            nextPages = [...nextRound];
            nextRound = [];
          }
        }
      }

      await logger.debug(
        processedPages.length,
        'urls:\n\n',
        processedPages.join('\n')
      );

      await logger.info(
        filesAlreadyDownloaded.length,
        'files:\n\n',
        filesAlreadyDownloaded.map((f) => f.replace(outDir, '')).join('\n')
      );

      await logger.info(`Done running Web Archiver ${WebArchiver.version}`);
    }
  }
}

export default WebArchiver;
