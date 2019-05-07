// 负责管理account balance情况，对外暴露account余额，变化情况
import {
    accountReq,
    accountSub
} from '../api/account'
import {
    flatMap,
    groupBy,
    mergeMapTo,
    reduce,
    take,
    tap
} from 'rxjs/operators';

import BigNumber from 'bignumber.js'
import {
    EMPTY_ERR_HANDLER
} from '../base/const'
import {
    from
} from 'rxjs';

const account = {}

const start = function start (pool) {
    const accountReqSub = accountReq(pool.client, pool.messageQueue)
    accountReqSub.pipe(
        take(1),
        //打散成多个账户
        flatMap(datas => from(datas)),
        //继续平铺成多个币种
        flatMap(data => from(data.list).pipe(
            groupBy(acc => acc.currency),
            flatMap(group => group.pipe(reduce((acc, value) => {
                acc.currency = value.currency
                acc[value.type] = new BigNumber(value.balance)
                return acc
            }, {}))),
            tap(acc => {
                acc.id = data.id
                acc.state = data.state

                if (!acc.forzen) {
                    acc.forzen = new BigNumber(0)
                }
                acc.available = acc.trade
            }),
        )),
        groupBy(acc => acc.id),
        flatMap(group => group.pipe(
            reduce((result, value) => {
                result.id = value.id
                result.state = value.state
                result[value.currency] = value
                return result
            }, {}),
        )),
    ).subscribe(
        data => {
            account[data.id] = data
        },
        err => console.error(err)
    )

    accountReqSub.pipe(
        //不能在一个ws里同时订阅可用和全部余额，脑残设计！！！
        mergeMapTo(accountSub(pool.client, pool.messageQueue))
    ).subscribe(
        data => {
            account[data['account-id']][data.currency].available = new BigNumber(data.balance)
        },
        EMPTY_ERR_HANDLER
    )
}


module.exports = {
    account,
    start
}