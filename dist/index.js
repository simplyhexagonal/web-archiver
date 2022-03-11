var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// src/index.ts
__export(exports, {
  UTF_RESOURCE_TYPES: () => UTF_RESOURCE_TYPES,
  default: () => src_default
});

// package.json
var version = "0.9.3";

// src/index.ts
var import_path = __toModule(require("path"));
var import_fs = __toModule(require("fs"));
var import_url = __toModule(require("url"));
var import_mono_context = __toModule(require("@simplyhexagonal/mono-context"));
var import_logger = __toModule(require("@simplyhexagonal/logger"));
var import_multi_replace = __toModule(require("@simplyhexagonal/multi-replace"));
var import_puppeteer = __toModule(require("puppeteer"));
var UTF_RESOURCE_TYPES = [
  "document",
  "stylesheet",
  "script"
];
var _WebArchiver = class {
  constructor() {
    const { webArchiverInstance, logger } = import_mono_context.default.getState();
    this.logger = logger || new import_logger.default({});
    if (webArchiverInstance) {
      return webArchiverInstance;
    }
  }
  async launchBrowser() {
    const { logger } = this;
    logger.debug("Launching browser...");
    logger.time("Launched browser in");
    this.browser = await import_puppeteer.default.launch({ headless: true });
    const page = await this.browser.newPage();
    await page.setRequestInterception(true);
    this.page = page;
    logger.timeEnd("Launched browser in");
  }
  async run({
    dryRun,
    urls,
    referer,
    outDir,
    recursive,
    maxRecursiveDepth,
    allowNavigateAway,
    blackListUrls
  }) {
    const {
      logger,
      page
    } = this;
    if (!dryRun) {
      try {
        (0, import_fs.mkdirSync)(outDir, { recursive: true });
      } catch (e) {
        if (e.code !== "EEXIST") {
          await logger.error(e);
          throw e;
        } else {
          logger.warn("Output directory already exists");
        }
      }
    }
    if (page) {
      if (referer) {
        page.setExtraHTTPHeaders({ referer });
      }
      const hosts = urls.map((url) => new import_url.URL(url).host);
      const resourceTypeMap = {};
      const filesToDownload = [];
      const filesAlreadyDownloaded = [];
      const processedUrls = [];
      let currentRecursionDepth = 0;
      await logger.info(`Running Web Archiver ${_WebArchiver.version}`);
      await logger.info(`Given urls:

${urls.join("\n")}`);
      if (!dryRun) {
        await logger.info(`Creating output directories...`);
        await hosts.reduce(async (a, host) => {
          await a;
          try {
            (0, import_fs.rmdirSync)((0, import_path.resolve)(outDir, host), { recursive: true });
            (0, import_fs.mkdirSync)((0, import_path.resolve)(outDir, host), { recursive: true });
          } catch (e) {
            await logger.warn(e);
          }
          return Promise.resolve();
        }, Promise.resolve());
        await logger.info(`Done creating output directories.`);
      }
      page.on("request", (interceptedRequest) => {
        const u = interceptedRequest.url();
        const url = new import_url.URL(u);
        if (!(blackListUrls || []).includes(u) && (allowNavigateAway || hosts.includes(url.host))) {
          const resourceType = interceptedRequest.resourceType();
          const outFilePath = (0, import_path.resolve)(outDir, url.host, url.pathname.replace(/^\//, ""));
          if (!filesAlreadyDownloaded.includes(outFilePath)) {
            filesToDownload.push(outFilePath);
            resourceTypeMap[outFilePath] = resourceType;
          }
        }
        interceptedRequest.continue();
      });
      page.on("response", async (interceptedResponse) => {
        const url = new import_url.URL(interceptedResponse.url());
        const {
          "content-type": contentType
        } = interceptedResponse.headers();
        let outFilePath = (0, import_path.resolve)(outDir, url.host, url.pathname.replace(/^\//, ""));
        if (filesToDownload.includes(outFilePath) && !filesAlreadyDownloaded.includes(outFilePath)) {
          filesAlreadyDownloaded.push(outFilePath);
          if (!dryRun) {
            const resourceType = resourceTypeMap[outFilePath];
            if (resourceType === "document" && contentType.includes("text/html")) {
              outFilePath = (0, import_multi_replace.multiReplaceSync)(outFilePath, [
                [new RegExp(`/output/${url.host}$`), `/output/${url.host}/index.html`],
                [/\/([^\/\.]*?)$/, "/$1/index.html"]
              ]);
            }
            await logger.debug(`Saving: ${outFilePath}`);
            const encoding = UTF_RESOURCE_TYPES.includes(resourceTypeMap[outFilePath]) ? "utf8" : "binary";
            const outFileDir = outFilePath.replace(/\/[^\/]*?$/, "");
            try {
              (0, import_fs.mkdirSync)(outFileDir, { recursive: true });
            } catch (e) {
              if (e.code !== "EEXIST") {
                await logger.error(e);
                throw e;
              }
            }
            const content = await interceptedResponse.buffer();
            (0, import_fs.writeFileSync)(outFilePath, content, { encoding });
          }
        }
        if (!processedUrls.includes(`${url.host}${url.pathname}`)) {
          processedUrls.push(`${url.host}${url.pathname}`);
        }
      });
      let nextPages = [...urls];
      let nextRound = [];
      const processedPages = [];
      while (nextPages.length > 0) {
        const u = nextPages.shift() || "";
        const url = new import_url.URL(u);
        if (!processedUrls.includes(`${url.host}${url.pathname}`)) {
          await logger.info(`Visiting: ${u}`);
          processedUrls.push(`${url.host}${url.pathname}`);
          const result = await page.goto(u, {
            waitUntil: "networkidle0",
            referer
          });
          processedPages.push(u);
          if (result.status() === 200) {
            const links = await page.$$("a");
            (await Promise.all((await Promise.all(links.map((l) => l.getProperty("href")))).map((p) => p.jsonValue()))).filter((l) => l && !(blackListUrls || []).includes(l)).map((l) => new import_url.URL(l)).filter((l) => {
              return !processedUrls.includes(`${l.host}${l.pathname}`) && (allowNavigateAway || hosts.includes(l.host));
            }).forEach((l) => {
              nextRound.push(`${l.protocol}//${l.host}${l.pathname}`);
            });
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
      await logger.debug(processedPages.length, "urls:\n\n", processedPages.join("\n"));
      await logger.info(filesAlreadyDownloaded.length, "files:\n\n", filesAlreadyDownloaded.map((f) => f.replace(outDir, "")).join("\n"));
      await logger.info(`Done running Web Archiver ${_WebArchiver.version}`);
    }
  }
};
var WebArchiver = _WebArchiver;
WebArchiver.version = version;
var src_default = WebArchiver;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  UTF_RESOURCE_TYPES
});
//# sourceMappingURL=index.js.map
