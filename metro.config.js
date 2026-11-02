// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Media without verified redistribution rights (the Neila Rey warm-up poster)
 * is for development and internal testing only. Store builds resolve the
 * poster module to a stub, so the image never enters the bundle. Excluded when
 * the EAS profile is `production` or GYMRAT_STORE_BUILD=1 (set that for any
 * local release archive meant for TestFlight). Run Metro with --clear after
 * changing it.
 */
const isStoreBuild = process.env.EAS_BUILD_PROFILE === 'production' || process.env.GYMRAT_STORE_BUILD === '1';
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
