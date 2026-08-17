const { execFileSync } = require('child_process')
const path = require('path')

/**
 * Keep unsigned community builds internally consistent on macOS.
 *
 * A real Developer ID signature and Apple notarization remain the preferred
 * production setup. Until those credentials are available, Electron's nested
 * binaries still need a complete ad-hoc signature; otherwise Gatekeeper reports
 * the downloaded application as damaged instead of offering the usual manual
 * approval flow for an unidentified developer.
 */
module.exports = async function afterSign(context) {
    if(context.electronPlatformName !== 'darwin') {
        return
    }

    const appName = `${context.packager.appInfo.productFilename}.app`
    const appPath = path.join(context.appOutDir, appName)

    execFileSync('xattr', ['-cr', appPath], { stdio: 'inherit' })
    execFileSync('codesign', [
        '--force',
        '--deep',
        '--sign', '-',
        '--timestamp=none',
        appPath
    ], { stdio: 'inherit' })

    execFileSync('codesign', [
        '--verify',
        '--deep',
        '--strict',
        '--verbose=2',
        appPath
    ], { stdio: 'inherit' })
}
