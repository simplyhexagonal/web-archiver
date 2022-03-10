var __defProp = Object.defineProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/index.ts
__export(exports, {
  default: () => src_default
});

// package.json
var version = "1.0.0";

// src/index.ts
var Package = class {
  constructor() {
    this.sum = async (a, b) => Promise.resolve(a + b);
  }
};
Package.version = version;
var src_default = Package;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
//# sourceMappingURL=index.js.map
