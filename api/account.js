import {
    AccountWebSocket,
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
    tap
}
from 'rxjs/operators';

import {
    addSignature
} from './aws'
import {
    awsParams
} from '../config';
import {rest, cons} from '../base';
import {aws} from '.';

export default class AccountAPI {

    constructor () {
        this.authPassedSubject = new Subject()
    }

    sendAuth (pool) {
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
            data => this.authPassedSubject.next(data))

        return this.authPassedSubject
    }

    static accountReq (pool) {
        pool.send({
            op: REQ,
            topic: REQ_ACCOUNTS_LIST
        })

        return pool.messageQueue.pipe(
            filter(data => data.topic === REQ_ACCOUNTS_LIST && data.op === REQ),
            map(data => data.data)
        )
    }

    static accountSub (pool, model, cid) {
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

    static getAccountInfoByHttp (){
        return from(
            rest.get(cons.AccountAPI + cons.Accounts, aws.addSignature({
                url: cons.AccountAPI + cons.Accounts,
                method: cons.GET
            }, awsParams)
            ).pipe(
                filter(data => data.status === 'ok'),
                map(data => data.data)
            )
        )
    }

    static getAccountBalanceByHttp (accountId){
        return from(
            rest.get(cons.AccountAPI + cons.Accounts +`/${accountId}/balance`, aws.addSignature({
                url: cons.AccountAPI + cons.Accounts +`/${accountId}/balance`,
                method: cons.GET
            }, awsParams)
            ).pipe(
                filter(data => data.status === 'ok'),
                map(data => data.data)
            )
        )
    }
}