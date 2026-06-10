const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const electronBinary = require('electron')
const env = { ...process.env }
const args = ['.']

delete env.ELECTRON_RUN_AS_NODE

if(process.platform === 'linux') {
    const sandboxPath = path.join(path.dirname(electronBinary), 'chrome-sandbox')
    const sandboxMode = fs.existsSync(sandboxPath) ? fs.statSync(sandboxPath).mode : 0

    if((sandboxMode & 0o4000) === 0) {
        args.push('--no-sandbox')
    }
}

const child = spawn(electronBinary, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env
})

child.on('exit', (code, signal) => {
    if(signal != null) {
        process.kill(process.pid, signal)
    } else {
        process.exit(code == null ? 0 : code)
    }
})

child.on('error', err => {
    console.error(err)
    process.exit(1)
})
