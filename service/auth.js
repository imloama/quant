import {AccountWebSocket, OP_AUTH, ERR_CODE} from '../base/const'
import {filter} from 'rxjs/operators';
import * as urlUtil from 'url'
import {getLogger} from 'log4js';
import {cons} from '../base';
import {Subject} from 'rxjs';
import * as crypto from 'crypto';

export default class Auth {
    constructor (id, key) {
        this.id = id
        this.key = key
    }

    sendAuth (pool) {
        const authPassedSubject = new Subject()

        pool.messageQueue.pipe(
            filter(data => data.messageType === 'open'),
        ).subscribe(() => {
            const data = this.addSignature(AccountWebSocket, cons.GET, {})

            data.op = 'auth'

            pool.send(data)
        })

        pool.messageQueue.pipe(
            filter(data => data.op === OP_AUTH && !data[ERR_CODE]),
        ).subscribe(
            data => authPassedSubject.next(data))

        return authPassedSubject
    }

    addSignature (url, method, params) {
        const timeStamp = Auth.getUTCTime()
        params.Timestamp = timeStamp
        params.SignatureMethod = 'HmacSHA256'
        params.SignatureVersion = '2'
        params.AccessKeyId = this.id

        const sorted = {}
        Object.keys(params).sort().forEach(key => {
            sorted[key] = encodeURIComponent(params[key])
        })


        const urlInfo = urlUtil.parse(url)
        let toBeSigned = `${method.toUpperCase()}\n` +
        `${urlInfo.host}\n` +
        `${urlInfo.path}\n` +
        `${Object.keys(sorted).map(key => key + '=' + sorted[key]).join('&')}`

        getLogger().info(toBeSigned)
        const signature = crypto.createHmac('sha256', this.key).update(toBeSigned, 'utf8').digest('base64')
        params.Signature = signature

        return params
    }

    static getUTCTime () {
        return new Date().toISOString().slice(0, -5)
    }
}