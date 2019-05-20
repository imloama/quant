import {getLogger} from 'log4js';
import {notifier} from '../config';
import{post} from '../base/rest'

const sendMsg = function sendMsg (message){
    if(!notifier || !notifier.dingding){
        getLogger().warn('config for dingding not found')
        return
    }

    let msgObj = null
    if(typeof message === 'string'|| message instanceof String){
        msgObj = JSON.parse(message)
    }else {
        msgObj = message
    }

    /*
     * curl 'https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxx' \
     * -H 'Content-Type: application/json' \
     * -d '{"msgtype": "text", 
     *      "text": {
     *           "content": "我就是我, 是不一样的烟火"
     *      }
     *    }'   
     */

    post(notifier.dingding.webhook, {
        msgtype: 'text',
        text: {
            content: JSON.stringify(msgObj, null, 2)
        }
    }).subscribe(null, getLogger().debug)
}

const sendAlert = function sendAlert (message){
    let msgObj = null
    if(typeof message === 'string'|| message instanceof String){
        msgObj = JSON.parse(message)
    }else {
        msgObj = message
    }

    post(notifier.dingding.webhook, {
        msgtype: 'text',
        text: {
            content: JSON.stringify(msgObj, null, 2)
        },
        at: {atMobiles: notifier.dingding.mobiles}
    }).subscribe(null, getLogger().debug)
}


export {
    sendMsg,
    sendAlert
}

/*
 * module.exports ={
 *     sendMsg
 * }
 */