import {configure, getLogger as logger} from 'log4js';

import config from '../config'

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

    logger().info('Logger config finished');
}

//category defines at init  
const getLogger = function getLogger (category){
    if(category) {
        return logger(category)
    }

    return logger()
}

export {
    init,
    getLogger
}