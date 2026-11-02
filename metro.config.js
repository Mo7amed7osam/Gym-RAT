// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Media without verified redistribution rights (the Neila Rey warm-up poster)
 * is for development and internal local testing only. The poster module is
 * already empty in every release bundle (`__DEV__` gate in
 * assets/exercises/index.ts); as a second layer, distributable EAS profiles
 * and GYMRAT_STORE_BUILD=1 resolve it to a stub even in a dev bundle. Any EAS
 * profile other than the two development ones counts as distributable.
 */
const DEV_PROFILES = new Set(['development', 'development-device']);
const profile = process.env.EAS_BUILD_PROFILE;
const isStoreBuild = (profile !== undefined && !DEV_PROFILES.has(profile)) || process.env.GYMRAT_STORE_BUILD === '1';
const POSTERS_DIR = path.join(__dirname, 'assets', 'exercises');
const POSTERS_STUB = path.join(POSTERS_DIR, 'index.store.ts');

if (isStoreBuild) {
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolution = upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
    if (resolution.type === 'sourceFile' && path.dirname(resolution.filePath) === POSTERS_DIR && /^index\.tsx?$/.test(path.basename(resolution.filePath))) {
      return { type: 'sourceFile', filePath: POSTERS_STUB };
    }
    return resolution;
  };
}

module.exports = config;
