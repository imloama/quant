// 负责管理account balance情况，对外暴露account余额，变化情况

import {
    Subject,
    from
} from 'rxjs';
import {
    flatMap,
    groupBy,
    mergeMapTo,
    reduce,
    take,
    tap,
    share
} from 'rxjs/operators';

import BigNumber from 'bignumber.js'

import {
    getLogger
} from 'log4js';
import AccountAPI from '../api/account';

export default class AccountBalance {
    constructor (){
        this.account = {}
    }

    start (pool) {
        getLogger().info('account balance monitor starting...')
       
        const accountStartSub = new Subject()

        const accountReqSub = AccountAPI.accountReq(pool).pipe(share())

        if(this.sub1){
            this.sub1.unsubscribe()
        }
        this.sub1 = accountReqSub.pipe(
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
                    acc['account-type'] = data.type

                    if (!acc.frozen) {
                        acc.frozen = new BigNumber(0)
                    }
                    acc.available = acc.trade
                    Reflect.deleteProperty(acc, 'trade')
                }),
            )),
            groupBy(acc => acc.id),
            flatMap(group => group.pipe(
                reduce((result, value) => {
                    result.id = value.id
                    result.state = value.state
                    result['account-type'] = value['account-type']
                    result[value.currency] = value
                    return result
                }, {}),
            )),
        ).subscribe(data => {
            this.account[data.id] = data
        },
            err => getLogger().error(err) 
        )

        if(this.sub2){
            this.sub2.unsubscribe()
        }

        this.sub2 = accountReqSub.pipe(
            mergeMapTo(AccountAPI.accountSub(pool))
        ).subscribe(
            data => {
                accountStartSub.next(1)
                getLogger('debug').debug(JSON.stringify(data))
                if (!this.account[data['account-id']][data.currency]) {
                    this.account[data['account-id']][data.currency] = {}
                }
                this.account[data['account-id']][data.currency].available = new BigNumber(data.balance)

                if (Math.random() < 0.05) {
                    getLogger().info(this.account)
                }
            },
            getLogger().error
        )

        return accountStartSub
    }

    getAccountIdByType (accountType) {
        for (let key in this.account) {
            if (this.account[key]['account-type'] === accountType) {
                return key
            }
        }

        return 0
    }

}