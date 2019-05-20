import {
    configure,
    getLogger
} from 'log4js';

import config from '../config'
import {
    dingding
} from '../notifier';

const registerErr = function registerErr () {
    const orgLogger = Reflect.getPrototypeOf(getLogger()).error

    Reflect.getPrototypeOf(getLogger()).error = function error (message, ...args) {
        const arrArgs = []
        arrArgs.push(message)
        arrArgs.push(args)
        Reflect.apply(orgLogger, getLogger(), arrArgs)

        //call dingding
        if (message instanceof Error) {
            dingding.sendAlert(String(message))
            return
        }

        dingding.sendAlert(message)
    }
}

const init = function init () {
    configure({
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

    getLogger().info('Logger config finished');
    registerErr()
}

export {
            init
        }