/**
 * Core UI functions are initialized in this file. This prevents
 * unexpected errors from breaking the core features. Specifically,
 * actions in this file should not require the usage of any internal
 * modules, excluding dependencies.
 */
// Requirements
const $                              = require('jquery')
const {ipcRenderer, shell, webFrame} = require('electron')
const remote                         = require('@electron/remote')
const isDev                          = require('./assets/js/isdev')
const { LoggerUtil }                 = require('helios-core')
const Lang                           = require('./assets/js/langloader')

const loggerUICore             = LoggerUtil.getLogger('UICore')
const loggerAutoUpdater        = LoggerUtil.getLogger('AutoUpdater')

const launcherUpdateSealState = {
    version: null,
    downloaded: false
}

function setLauncherUpdateSeal(version, downloaded){
    launcherUpdateSealState.version = version
    launcherUpdateSealState.downloaded = downloaded
    refreshLauncherUpdateSeal()
}

function clearLauncherUpdateSeal(){
    launcherUpdateSealState.version = null
    launcherUpdateSealState.downloaded = false
    refreshLauncherUpdateSeal()
}

function resolveDarwinDownloadUrl(info){
    if(info == null || typeof info.version !== 'string' || info.version.length === 0){
        return null
    }

    const releaseBase = `https://github.com/Fab0uu/Eidolyth-Launcher/releases/download/v${info.version}/`
    if(Array.isArray(info.files)){
        const dmgFile = info.files.find(file => typeof file?.url === 'string' && file.url.toLowerCase().endsWith('.dmg'))
        if(dmgFile != null){
            return dmgFile.url.startsWith('http') ? dmgFile.url : `${releaseBase}${dmgFile.url.replace(/^\/+/, '')}`
        }
    }

    return `${releaseBase}Eidolyth-Launcher-setup.dmg`
}

async function openLauncherUpdateView(sourceElement){
    if(sourceElement != null && typeof sourceElement.blur === 'function'){
        sourceElement.blur()
    }

    if(typeof prepareSettings === 'function'){
        await prepareSettings()
    }

    if(getCurrentView() === VIEWS.settings){
        settingsNavItemListener(document.getElementById('settingsNavUpdate'), false)
        return
    }

    switchView(getCurrentView(), VIEWS.settings, 500, 500, () => {
        settingsNavItemListener(document.getElementById('settingsNavUpdate'), false)
    })
}

function installLauncherUpdate(sourceElement){
    if(sourceElement != null && typeof sourceElement.blur === 'function'){
        sourceElement.blur()
    }

    if(!isDev){
        if(sourceElement != null){
            sourceElement.disabled = true
        }
        ipcRenderer.send('autoUpdateAction', 'installUpdateNow')
    } else {
        loggerAutoUpdater.warn('Cannot install updates in development environment.')
    }
}

function refreshLauncherUpdateSeal(){
    const seal = document.getElementById('image_seal_container')
    const tooltip = document.getElementById('updateAvailableTooltip')

    if(!seal || !tooltip){
        return
    }

    const idleTooltipLabel = Lang.queryJS('landing.updateAvailableTooltip')
    seal.removeAttribute('update')
    seal.removeAttribute('data-update-state')
    seal.removeAttribute('aria-describedby')
    seal.classList.remove('is-actionable')
    seal.disabled = true
    seal.onclick = null
    seal.setAttribute('aria-label', 'Eidolyth')
    tooltip.textContent = idleTooltipLabel

    if(!launcherUpdateSealState.version){
        return
    }

    const isDownloaded = launcherUpdateSealState.downloaded
    const tooltipLabel = Lang.queryJS(
        isDownloaded ? 'uicore.autoUpdate.versionBadgeReady' : 'uicore.autoUpdate.versionBadgeAvailable',
        { version: launcherUpdateSealState.version }
    )

    seal.setAttribute('update', 'true')
    seal.dataset.updateState = isDownloaded ? 'ready' : 'pending'
    seal.setAttribute('aria-describedby', 'updateAvailableTooltip')
    seal.setAttribute('aria-label', tooltipLabel)
    seal.classList.add('is-actionable')
    seal.disabled = false
    seal.onclick = async () => {
        if(isDownloaded){
            installLauncherUpdate(seal)
        } else {
            await openLauncherUpdateView(seal)
        }
    }
    tooltip.textContent = tooltipLabel
}

// Log deprecation and process warnings.
process.traceProcessWarnings = true
process.traceDeprecation = true

// Disable eval function.
// eslint-disable-next-line
window.eval = global.eval = function () {
    throw new Error('Sorry, this app does not support window.eval().')
}

// Disable zoom, needed for darwin.
webFrame.setZoomLevel(0)
webFrame.setVisualZoomLevelLimits(1, 1)

// Initialize auto updates in production environments.
let updateCheckListener
if(!isDev){
    ipcRenderer.on('autoUpdateNotification', (event, arg, info) => {
        switch(arg){
            case 'checking-for-update':
                loggerAutoUpdater.info('Checking for update..')
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.checkingForUpdateButton'), true)
                break
            case 'update-available':
                loggerAutoUpdater.info('New update available', info.version)
                setLauncherUpdateSeal(info.version, false)

                if(process.platform === 'darwin'){
                    info.darwindownload = resolveDarwinDownloadUrl(info)
                }

                populateSettingsUpdateInformation(info)
                break
            case 'update-downloaded':
                loggerAutoUpdater.info('Update ' + info.version + ' ready to be installed.')
                setLauncherUpdateSeal(info.version, true)
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.installNowButton'), false, () => {
                    if(!isDev){
                        ipcRenderer.send('autoUpdateAction', 'installUpdateNow')
                    }
                })
                break
            case 'update-not-available':
                loggerAutoUpdater.info('No new update found.')
                clearLauncherUpdateSeal()
                populateSettingsUpdateInformation(null)
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.checkForUpdatesButton'))
                break
            case 'ready':
                updateCheckListener = setInterval(() => {
                    ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
                }, 1800000)
                ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
                break
            case 'realerror':
                clearLauncherUpdateSeal()
                populateSettingsUpdateInformation(null)
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.checkForUpdatesButton'))
                if(info != null && info.code != null){
                    if(info.code === 'ERR_UPDATER_INVALID_RELEASE_FEED'){
                        loggerAutoUpdater.info('No suitable releases found.')
                    } else if(info.code === 'ERR_XML_MISSED_ELEMENT'){
                        loggerAutoUpdater.info('No releases found.')
                    } else {
                        loggerAutoUpdater.error('Error during update check..', info)
                        loggerAutoUpdater.debug('Error Code:', info.code)
                    }
                }
                break
            default:
                loggerAutoUpdater.info('Unknown argument', arg)
                break
        }
    })
} else {
    window.DEBUG_forceUpdateBadge = (version = '9.9.9', downloaded = false) => {
        loggerAutoUpdater.info('[DEV] Forcing launcher update seal state', version, downloaded)
        setLauncherUpdateSeal(version, downloaded)
    }
    window.DEBUG_forceUpdateSeal = window.DEBUG_forceUpdateBadge
}

/**
 * Send a notification to the main process changing the value of
 * allowPrerelease. If we are running a prerelease version, then
 * this will always be set to true, regardless of the current value
 * of val.
 * 
 * @param {boolean} val The new allow prerelease value.
 */
function changeAllowPrerelease(val){
    ipcRenderer.send('autoUpdateAction', 'allowPrereleaseChange', val)
}

/* jQuery Example
$(function(){
    loggerUICore.info('UICore Initialized');
})*/

document.addEventListener('readystatechange', function () {
    if (document.readyState === 'interactive'){
        loggerUICore.info('UICore Initializing..')
        refreshLauncherUpdateSeal()

        // Bind close button.
        Array.from(document.getElementsByClassName('fCb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                window.close()
            })
        })

        // Bind restore down button.
        Array.from(document.getElementsByClassName('fRb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                if(window.isMaximized()){
                    window.unmaximize()
                } else {
                    window.maximize()
                }
                document.activeElement.blur()
            })
        })

        // Bind minimize button.
        Array.from(document.getElementsByClassName('fMb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                window.minimize()
                document.activeElement.blur()
            })
        })

        // Remove focus from social media buttons once they're clicked.
        Array.from(document.getElementsByClassName('mediaURL')).map(val => {
            val.addEventListener('click', e => {
                document.activeElement.blur()
            })
        })

    } else if(document.readyState === 'complete'){
        refreshLauncherUpdateSeal()
    }

}, false)

/**
 * Open web links in the user's default browser.
 */
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault()
    shell.openExternal(this.href)
})

/**
 * Opens DevTools window if you hold (ctrl + shift + i).
 * This will crash the program if you are using multiple
 * DevTools, for example the chrome debugger in VS Code. 
 */
document.addEventListener('keydown', function (e) {
    if((e.key === 'I' || e.key === 'i') && e.ctrlKey && e.shiftKey){
        let window = remote.getCurrentWindow()
        window.toggleDevTools()
    }
})
