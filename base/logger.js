import {configure, getLogger} from 'log4js';

import config from '../config'
import {dingding} from '../notifier';

const registerErr = function registerErr (){
    const orgLogger = getLogger().error


    getLogger().error = function error (message, ...args){
        orgLogger(message, args)
        dingding.sendMsg(message) 
    }
}

const init = function init (){
    configure({
        appenders: {std: {type: 'console'}, 
            file: {type: 'file',
                filename: config.log.file.name,
                maxLogSize: 10485760,
                backups: 10,
                pattern: '.yyyy-MM-dd',
                compress: true}},
        categories: {debug: {
            appenders: ['std'],
            level: 'debug'
        }, 
            default: {appenders: [
                'file',
                'std'
            ],
                level: 'info'}}
    });

    getLogger().info('Logger config finished');
    registerErr()
}

export {
    init
}