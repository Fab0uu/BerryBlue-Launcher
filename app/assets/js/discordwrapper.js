// Work in progress
const { LoggerUtil } = require('helios-core')

const logger = LoggerUtil.getLogger('DiscordWrapper')

const { Client } = require('discord-rpc-patch')

const Lang = require('./langloader')

let client
let activity

exports.initRPC = function(genSettings, servSettings, initialDetails = Lang.queryJS('discord.waiting')){
    client = new Client({ transport: 'ipc' })
    activity = {
        details: initialDetails,
        state: Lang.queryJS('discord.state', {shortId: servSettings.shortId}),
        largeImageKey: servSettings.largeImageKey,
        largeImageText: servSettings.largeImageText,
        startTimestamp: new Date().getTime(),
        instance: false
    }

    if(typeof genSettings.smallImageKey === 'string' && genSettings.smallImageKey.length > 0){
        activity.smallImageKey = genSettings.smallImageKey
        if(typeof genSettings.smallImageText === 'string' && genSettings.smallImageText.length > 0){
            activity.smallImageText = genSettings.smallImageText
        }
    }
    client.on('ready', () => {
        logger.info('Discord RPC Connected')
        client.setActivity(activity)
    })
    
    client.login({clientId: genSettings.clientId}).catch(error => {
        if(error.message.includes('ENOENT')) {
            logger.info('Unable to initialize Discord Rich Presence, no client detected.')
        } else {
            logger.info('Unable to initialize Discord Rich Presence: ' + error.message, error)
        }
    })
}

exports.shutdownRPC = function(){
    if(!client) return
    client.clearActivity()
    client.destroy()
    client = null
    activity = null
}

exports.updateDetails = function(details){
    if(!client || !activity){
        return
    }
    activity.details = details
    client.setActivity(activity)
}
