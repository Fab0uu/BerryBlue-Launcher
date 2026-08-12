const fs = require('fs-extra')
const got = require('got')
const os = require('os')
const path = require('path')

const DEFAULT_API_BASE_URL = 'https://api.eidolyth.fr/gatekeeper/v1'
const ISSUE_TIMEOUT_MILLIS = 10000
const SESSION_TIMEOUT_MILLIS = 5000
const MAX_TOKEN_LENGTH = 8192

class GatekeeperError extends Error {
    constructor(code, message) {
        super(message)
        this.name = 'GatekeeperError'
        this.code = code
    }
}

function resolveApiBaseUrl(configuredUrl = null) {
    const rawUrl = configuredUrl || DEFAULT_API_BASE_URL

    let parsed
    try {
        parsed = new URL(rawUrl)
    } catch (_err) {
        throw new GatekeeperError('invalid_configuration', 'Invalid Gatekeeper API URL.')
    }

    const loopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
    if(parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) {
        throw new GatekeeperError('invalid_configuration', 'Gatekeeper requires HTTPS outside local development.')
    }

    return parsed.toString().replace(/\/+$/, '')
}

function validateToken(sessionToken) {
    if(typeof sessionToken !== 'string') {
        throw new GatekeeperError('invalid_response', 'Gatekeeper returned an invalid session.')
    }
    const normalized = sessionToken.trim()
    if(normalized.length < 16 || normalized.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
        throw new GatekeeperError('invalid_response', 'Gatekeeper returned an invalid session.')
    }
    return normalized
}

function readErrorCode(responseBody) {
    return responseBody && typeof responseBody.error === 'string'
        ? responseBody.error
        : null
}

async function issueSession({
    authUser,
    launcherVersion,
    installationId,
    apiBaseUrl = null,
    httpClient = got
}) {
    if(!authUser || typeof authUser.accessToken !== 'string' || authUser.accessToken.trim().length === 0) {
        throw new GatekeeperError('minecraft_authentication_required', 'Minecraft authentication is required.')
    }

    const endpoint = `${resolveApiBaseUrl(apiBaseUrl)}/sessions/issue`
    let response
    try {
        response = await httpClient.post(endpoint, {
            headers: {
                authorization: `Bearer ${authUser.accessToken}`,
                accept: 'application/json',
                'user-agent': `Eidolyth-Launcher/${launcherVersion}`
            },
            json: {
                minecraftUuid: authUser.uuid,
                minecraftUsername: authUser.displayName,
                launcherVersion,
                installationId
            },
            responseType: 'json',
            throwHttpErrors: false,
            retry: 0,
            timeout: {
                request: ISSUE_TIMEOUT_MILLIS
            }
        })
    } catch (_err) {
        throw new GatekeeperError('service_unavailable', 'Gatekeeper is unavailable.')
    }

    if(response.statusCode === 401) {
        throw new GatekeeperError(
            readErrorCode(response.body) || 'minecraft_identity_rejected',
            'The Minecraft identity was rejected.'
        )
    }
    if(response.statusCode !== 201 || !response.body || typeof response.body !== 'object') {
        throw new GatekeeperError(
            readErrorCode(response.body) || 'service_unavailable',
            'Gatekeeper could not create a launch session.'
        )
    }

    return {
        sessionToken: validateToken(response.body.sessionToken),
        minecraftUuid: response.body.minecraftUuid,
        minecraftUsername: response.body.minecraftUsername,
        issuedAt: response.body.issuedAt
    }
}

function writeSessionFile(sessionToken) {
    const token = validateToken(sessionToken)
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eidolyth-gatekeeper-'))
    const sessionFile = path.join(directory, 'session')

    try {
        if(process.platform !== 'win32') {
            fs.chmodSync(directory, 0o700)
        }
        fs.writeFileSync(sessionFile, token, {
            encoding: 'utf8',
            flag: 'wx',
            mode: 0o600
        })
    } catch (err) {
        fs.removeSync(directory)
        throw err
    }

    return {
        path: sessionFile,
        cleanup() {
            try {
                fs.removeSync(directory)
            } catch (_err) {
                // Best effort: the client mod normally deletes the file first.
            }
        }
    }
}

async function updateSession(endpointName, sessionToken, apiBaseUrl = null) {
    const token = validateToken(sessionToken)
    let response
    try {
        response = await got.post(`${resolveApiBaseUrl(apiBaseUrl)}/sessions/${endpointName}`, {
            headers: {
                authorization: `Bearer ${token}`,
                accept: 'application/json',
                'user-agent': 'Eidolyth-Launcher'
            },
            responseType: 'json',
            throwHttpErrors: false,
            retry: 0,
            timeout: {
                request: SESSION_TIMEOUT_MILLIS
            }
        })
    } catch (_err) {
        throw new GatekeeperError('service_unavailable', 'Gatekeeper is unavailable.')
    }

    if(response.statusCode < 200 || response.statusCode >= 300) {
        throw new GatekeeperError(
            readErrorCode(response.body) || 'session_update_rejected',
            'Gatekeeper rejected the session update.'
        )
    }
    return response.body
}

function heartbeatSession(sessionToken, apiBaseUrl = null) {
    return updateSession('heartbeat', sessionToken, apiBaseUrl)
}

function revokeSession(sessionToken, apiBaseUrl = null) {
    return updateSession('revoke', sessionToken, apiBaseUrl)
}

module.exports = {
    DEFAULT_API_BASE_URL,
    GatekeeperError,
    heartbeatSession,
    issueSession,
    resolveApiBaseUrl,
    revokeSession,
    writeSessionFile
}
