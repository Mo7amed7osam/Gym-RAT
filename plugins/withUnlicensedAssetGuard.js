// Adds a final build phase to the iOS app target that fails every Release
// build (EAS profiles, local Archive) whose product contains media without
// verified redistribution rights. See scripts/release/check-unlicensed-assets.sh.
const { withXcodeProject } = require('expo/config-plugins');

const PHASE_NAME = '[Gym RAT] Check unlicensed assets';

const SCRIPT = [
  'if [ "$CONFIGURATION" != "Release" ]; then',
  '  echo "Unlicensed asset check skipped ($CONFIGURATION build)"',
  '  exit 0',
  'fi',
  '"$PROJECT_DIR/../scripts/release/check-unlicensed-assets.sh" "$TARGET_BUILD_DIR/$WRAPPER_NAME"',
].join('\n');

module.exports = function withUnlicensedAssetGuard(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const target = project.getFirstTarget().uuid;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const exists = Object.values(phases).some((phase) => typeof phase === 'object' && phase.name === `"${PHASE_NAME}"`);
    if (!exists) {
      project.addBuildPhase([], 'PBXShellScriptBuildPhase', PHASE_NAME, target, {
        shellPath: '/bin/sh',
        shellScript: SCRIPT,
        // No inputs/outputs: run on every build so a stale product is never trusted.
        alwaysOutOfDate: 1,
      });
    }
    return config;
  });
};
