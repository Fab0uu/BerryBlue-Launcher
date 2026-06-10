const { execFileSync, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const distDir = path.join(projectRoot, 'dist')
const allowMissingRpm = process.argv.includes('--allow-missing-rpm')

function fail(message) {
    console.error(message)
    process.exit(1)
}

function normalizeEntry(entry) {
    return entry.replace(/^\.\//, '').replace(/\/$/, '')
}

function findArtifact(extension) {
    if(!fs.existsSync(distDir)) {
        fail(`Missing dist directory: ${distDir}`)
    }

    const matches = fs.readdirSync(distDir)
        .filter(file => file.startsWith('Eidolyth-Launcher-') && file.endsWith(extension))
        .map(file => path.join(distDir, file))

    if(matches.length === 0) {
        return null
    }

    matches.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    return matches[0]
}

function assertIncludes(entries, expected, label) {
    const normalized = new Set(entries.map(normalizeEntry))
    for(const entry of expected) {
        if(!normalized.has(normalizeEntry(entry))) {
            fail(`${label} is missing ${entry}`)
        }
    }
}

function listDebEntries(file) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidolyth-deb-'))
    try {
        execFileSync('ar', ['x', file], { cwd: tmpDir, stdio: 'ignore' })
        return execFileSync('tar', ['-tf', path.join(tmpDir, 'data.tar.xz')], { encoding: 'utf8' })
            .trim()
            .split('\n')
            .filter(Boolean)
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
}

function listAppImageEntries(file) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidolyth-appimage-'))
    try {
        execFileSync(file, ['--appimage-extract'], { cwd: tmpDir, stdio: 'ignore' })
        const root = path.join(tmpDir, 'squashfs-root')
        const entries = []
        const visit = dir => {
            for(const name of fs.readdirSync(dir)) {
                const fullPath = path.join(dir, name)
                const relative = path.relative(root, fullPath)
                entries.push(relative)
                if(fs.statSync(fullPath).isDirectory()) {
                    visit(fullPath)
                }
            }
        }
        visit(root)
        return entries
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
}

function listRpmEntries(file) {
    const result = spawnSync('bsdtar', ['-tf', file], { encoding: 'utf8' })
    if(result.status !== 0) {
        fail(`Unable to inspect rpm artifact: ${result.stderr || result.stdout}`)
    }
    return result.stdout.trim().split('\n').filter(Boolean)
}

const expectedDebEntries = [
    'opt/Eidolyth/eidolyth-launcher',
    'opt/Eidolyth/resources/app.asar',
    'opt/Eidolyth/resources/libraries/java/PackXZExtract.jar',
    'opt/Eidolyth/resources/package-type',
    'usr/share/applications/eidolyth-launcher.desktop',
    'usr/share/icons/hicolor/0x0/apps/eidolyth-launcher.png'
]

const expectedAppImageEntries = [
    'AppRun',
    'eidolyth-launcher',
    'eidolyth-launcher.desktop',
    'resources/app.asar'
]

const expectedRpmEntries = expectedDebEntries.map(entry => `./${entry}`)

const appImage = findArtifact('.AppImage')
const deb = findArtifact('.deb')
const rpm = findArtifact('.rpm')

if(appImage == null) {
    fail('Missing Linux AppImage artifact.')
}
if(deb == null) {
    fail('Missing Linux deb artifact.')
}
if(rpm == null && !allowMissingRpm) {
    fail('Missing Linux rpm artifact.')
}

assertIncludes(listAppImageEntries(appImage), expectedAppImageEntries, path.basename(appImage))
assertIncludes(listDebEntries(deb), expectedDebEntries, path.basename(deb))

if(rpm != null) {
    assertIncludes(listRpmEntries(rpm), expectedRpmEntries, path.basename(rpm))
} else {
    console.warn('Skipping rpm inspection because --allow-missing-rpm was provided.')
}

console.log('Linux artifacts verified.')
