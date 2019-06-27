import * as log4js from 'log4js'
import * as log4jsEx from 'log4js-extend'

import config from '../config'
import {
    dingding
} from '../notifier';

const registerErr = function registerErr () {
    const orgLogger = Reflect.getPrototypeOf(log4js.getLogger()).error

    Reflect.getPrototypeOf(log4js.getLogger()).error = function error (message, ...args) {
        const arrArgs = []
        arrArgs.push(message)
        arrArgs.push(args)
        Reflect.apply(orgLogger, log4js.getLogger(), arrArgs)
        if(true){
            return
        }

        //call dingding
        if (message instanceof Error) {
            dingding.sendAlert(String(message))
            return
        }

        dingding.sendAlert(message)
    }
}

const init = function init () {
    
    log4js.configure({
        appenders: {
            std: {
                type: 'console'
            },
            file: {
                type: 'file',
                filename: config.log.file.name,
                maxLogSize: 10485760,
                backups: 10,
                pattern: '.yyyy-MM-dd',
                compress: true
            }
        },
        categories: {
            debug: {
                appenders: ['std'],
                level: 'debug'
            },
            default: {
                appenders: [
                    'file',
                    'std'
                ],
                level: 'info'
            }
        }
    });
    log4jsEx.default(log4js.default, {
        path: '.',
        format: '[@name @file:@line:@column]'
    })
    log4js.getLogger().info('Logger config finished');
    registerErr()
}

export {
            init
        }