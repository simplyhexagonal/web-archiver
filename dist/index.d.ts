import Logger from '@simplyhexagonal/logger';
import { Browser, BrowserConnectOptions, BrowserLaunchArgumentOptions, LaunchOptions, Page, Product } from 'puppeteer';
export interface WebArchiverRunOptions {
    dryRun?: boolean;
    urls: string[];
    referer?: string;
    outDir: string;
    recursive: boolean;
    maxRecursiveDepth: number;
    allowNavigateAway?: boolean;
    blackListUrls?: string[];
}
export declare const UTF_RESOURCE_TYPES: string[];
declare class WebArchiver {
    static version: any;
    logger: Logger;
    browser?: Browser;
    page?: Page;
    constructor();
    launchBrowser(options?: LaunchOptions & BrowserLaunchArgumentOptions & BrowserConnectOptions & {
        product?: Product;
        extraPrefsFirefox?: Record<string, unknown>;
    }): Promise<void>;
    run({ dryRun, urls, referer, outDir, recursive, maxRecursiveDepth, allowNavigateAway, blackListUrls, }: WebArchiverRunOptions): Promise<void>;
}
export default WebArchiver;
