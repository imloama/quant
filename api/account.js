import {
    AccountWebSocket,
    EMPTY_ERR_HANDLER,
    ERR_CODE,
    NOTIFY,
    OP_ACCOUNTS,
    OP_AUTH,
    REQ,
    REQ_ACCOUNTS_LIST,
    SUB
} from '../base/const'
import {
    Subject,
    from
} from 'rxjs';
import {
    filter,
    flatMap,
    map,
    share,
    take
}
from 'rxjs/operators';

import {
    addSignature
} from './aws'
import {
    awsParams
} from '../config';

const authPassedSubject = new Subject()

const sendAuth = function sendAuth (pool) {
    pool.messageQueue.pipe(
        filter(data => data.messageType === 'open'),
    ).subscribe(() => {
        const reqParams = {
            url: AccountWebSocket,
            method: 'get',
            params: {}
        }
        const data = addSignature(reqParams, awsParams)

        data.op = 'auth'

        pool.send(data)
    })

    pool.messageQueue.pipe(
        filter(data => data.op === OP_AUTH && !data[ERR_CODE]),
    ).subscribe(
        data => authPassedSubject.next(data))

    return authPassedSubject
}

const accountReq = function accountReq (pool) {
    pool.send({
        op: REQ,
        topic: REQ_ACCOUNTS_LIST
    })

    return pool.messageQueue.pipe(
        filter(data => data.topic === REQ_ACCOUNTS_LIST && data.op === REQ),
        map(data => data.data),
        share()
    )
}

//eslint-disable-next-line
const accountSub = function accountSub(pool, model, cid) {
    if (!model) {
        //eslint-disable-next-line
        model = '0'
    }

    if (!cid) {
        //eslint-disable-next-line
        cid = String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
    }
    pool.send({
        op: SUB,
        model,
        cid,
        topic: OP_ACCOUNTS
    })

    return pool.messageQueue.pipe(
        filter(msg => msg.topic === OP_ACCOUNTS && msg.op === NOTIFY),
        flatMap(msg => from(msg.data.list)),
        share()
    )
}

module.exports = {
    accountSub,
    accountReq,
    sendAuth
}