const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs-extra')

const Gatekeeper = require('../../app/assets/js/gatekeeper')

test('issues a session with the Minecraft access token and identity', async () => {
    let receivedEndpoint
    let receivedOptions
    const httpClient = {
        async post(endpoint, options) {
            receivedEndpoint = endpoint
            receivedOptions = options
            return {
                statusCode: 201,
                body: {
                sessionToken: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
                minecraftUuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
                minecraftUsername: 'Notch',
                issuedAt: '2026-08-12T12:00:00.000Z'
                }
            }
        }
    }

    const session = await Gatekeeper.issueSession({
        authUser: {
            accessToken: 'minecraft-access-token',
            uuid: '069a79f444e94726a5befca90e38aaf5',
            displayName: 'Notch'
        },
        launcherVersion: '2.0.5',
        installationId: '8d9f9bf9-69a7-4e3c-a39d-e89900121ed5',
        httpClient
    })

    assert.equal(receivedEndpoint, 'https://api.eidolyth.fr/gatekeeper/v1/sessions/issue')
    assert.equal(receivedOptions.headers.authorization, 'Bearer minecraft-access-token')
    assert.equal(receivedOptions.json.minecraftUsername, 'Notch')
    assert.equal(receivedOptions.json.launcherVersion, '2.0.5')
    assert.equal(session.minecraftUsername, 'Notch')
})

test('writes the token to a private disposable file', t => {
    const tokenFile = Gatekeeper.writeSessionFile('abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG')
    t.after(tokenFile.cleanup)

    assert.equal(fs.readFileSync(tokenFile.path, 'utf8'), 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG')
    if(process.platform !== 'win32') {
        assert.equal(fs.statSync(tokenFile.path).mode & 0o077, 0)
    }

    tokenFile.cleanup()
    assert.equal(fs.existsSync(tokenFile.path), false)
})

test('does not allow an insecure remote Gatekeeper API', () => {
    assert.throws(
        () => Gatekeeper.resolveApiBaseUrl('http://api.eidolyth.fr/gatekeeper/v1'),
        error => error.code === 'invalid_configuration'
    )
})
