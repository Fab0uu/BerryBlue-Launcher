const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const Module = require('module')
const AdmZip = require('adm-zip')
const { Type } = require('helios-distribution-types')

const originalLoad = Module._load

Module._load = function(request, parent, isMain) {
    if(request === './configmanager' && parent?.filename?.endsWith(path.join('app', 'assets', 'js', 'processbuilder.js'))) {
        return {
            getInstanceDirectory: () => path.join(os.tmpdir(), 'eidolyth-test-instances'),
            getCommonDirectory: () => path.join(os.tmpdir(), 'eidolyth-test-common')
        }
    }

    return originalLoad.call(this, request, parent, isMain)
}

const ProcessBuilder = require('../../app/assets/js/processbuilder')

Module._load = originalLoad

function createBuilder(overrides = {}) {
    return Object.assign(Object.create(ProcessBuilder.prototype), overrides)
}

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'eidolyth-processbuilder-'))
}

test('classpath separator is platform specific', () => {
    assert.equal(ProcessBuilder.getClasspathSeparator(), process.platform === 'win32' ? ';' : ':')
})

test('adds the Gatekeeper session file as a JVM property', () => {
    const sessionFile = path.resolve(os.tmpdir(), 'eidolyth-session-test')
    const builder = createBuilder({ gatekeeperSessionFile: sessionFile })
    const args = []

    builder.appendGatekeeperJvmArgument(args)

    assert.deepEqual(args, [`-Deidolyth.gatekeeper.sessionFile=${sessionFile}`])
})

test('redacts account and Gatekeeper tokens from launch logs', () => {
    assert.deepEqual(
        ProcessBuilder.redactLaunchArguments([
            '--accessToken',
            'minecraft-secret',
            '-Deidolyth.gatekeeper.session=gatekeeper-secret'
        ]),
        [
            '--accessToken',
            '<redacted>',
            '-Deidolyth.gatekeeper.session=<redacted>'
        ]
    )
})

test('ensureJavaExecutableReady validates and fixes executable bit on Unix', t => {
    const tmpDir = createTempDir()
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

    const javaPath = path.join(tmpDir, 'java')
    fs.writeFileSync(javaPath, '#!/bin/sh\nexit 0\n')

    if(process.platform !== 'win32') {
        fs.chmodSync(javaPath, 0o644)
    }

    const builder = createBuilder()
    builder.ensureJavaExecutableReady(javaPath)

    if(process.platform !== 'win32') {
        assert.equal((fs.statSync(javaPath).mode & 0o111) !== 0, true)
    }

    assert.throws(() => builder.ensureJavaExecutableReady(path.join(tmpDir, 'missing-java')), /does not exist/)
})

test('1.19+ native extraction keeps only current OS and architecture', t => {
    if(process.platform !== 'linux' || process.arch !== 'x64') {
        return
    }

    const tmpDir = createTempDir()
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

    const libPath = path.join(tmpDir, 'libraries')
    const linuxNativePath = 'org/lwjgl/lwjgl/3.3.0/lwjgl-natives-linux.jar'
    const windowsNativePath = 'org/lwjgl/lwjgl/3.3.0/lwjgl-natives-windows.jar'

    fs.ensureDirSync(path.dirname(path.join(libPath, linuxNativePath)))
    const linuxZip = new AdmZip()
    linuxZip.addFile('nested/liblwjgl.so', Buffer.from('linux-native'))
    linuxZip.addFile('META-INF/signature', Buffer.from('skip-me'))
    linuxZip.writeZip(path.join(libPath, linuxNativePath))

    const windowsZip = new AdmZip()
    windowsZip.addFile('lwjgl.dll', Buffer.from('windows-native'))
    windowsZip.writeZip(path.join(libPath, windowsNativePath))

    const outputPath = path.join(tmpDir, 'natives')
    const builder = createBuilder({
        libPath,
        vanillaManifest: {
            libraries: [
                {
                    name: 'org.lwjgl:lwjgl:natives-linux-x64',
                    downloads: {
                        artifact: {
                            path: linuxNativePath
                        }
                    }
                },
                {
                    name: 'org.lwjgl:lwjgl:natives-windows-x64',
                    downloads: {
                        artifact: {
                            path: windowsNativePath
                        }
                    }
                }
            ]
        }
    })

    builder._resolveMojangLibraries(outputPath)

    assert.equal(fs.readFileSync(path.join(outputPath, 'liblwjgl.so'), 'utf8'), 'linux-native')
    assert.equal(fs.existsSync(path.join(outputPath, 'lwjgl.dll')), false)
    assert.equal(fs.existsSync(path.join(outputPath, 'META-INF', 'signature')), false)
})

test('module library resolution walks nested submodules and respects classpath false', () => {
    const builder = createBuilder()
    const nestedLibrary = {
        rawModule: {
            type: Type.Library
        },
        subModules: [],
        getVersionlessMavenIdentifier: () => 'com.example:nested',
        getPath: () => '/libs/nested.jar'
    }
    const skippedLibrary = {
        rawModule: {
            type: Type.Library,
            classpath: false
        },
        subModules: [],
        getVersionlessMavenIdentifier: () => 'com.example:skipped',
        getPath: () => '/libs/skipped.jar'
    }
    const parentModule = {
        rawModule: {
            type: Type.ForgeMod
        },
        subModules: [
            {
                rawModule: {
                    type: Type.ForgeMod
                },
                subModules: [nestedLibrary]
            },
            skippedLibrary
        ]
    }

    assert.deepEqual(builder._resolveModuleLibraries(parentModule), {
        'com.example:nested': '/libs/nested.jar'
    })
})
