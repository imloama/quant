import {
    from,
    zip
} from 'rxjs';
import {logger, types} from './base';
import {
    mergeMap,
    tap
} from 'rxjs/operators';

import {
    appendHistoryKlines
} from './handler/spot_kline_storage'
import {
    awsParams
} from './config';
import {
    start as balanceStart
} from './handler/account_balance'
import {getLogger} from 'log4js';
import {
    start as gridStart
} from './handler/grid'
import inquirer from 'inquirer'
import {
    start as orderSaveStart
} from './handler/spot_order_storage'
import {
    pool
} from './connection/spot_pool'
import {
    sendAuth
} from './api/account'
import {
    pool as spotMarketPool
} from './connection/spot_market_pool'

const main = function main () {
    logger.init()
    //初始化数据库信息
    types.init()

    //start message pool
    spotMarketPool.start()
    pool.start()

      //send auth message
    const authPassedSubject = sendAuth(pool)
    
    authPassedSubject.pipe(
        mergeMap(() => zip(
            //req account info and sub account change
            balanceStart(pool),
            //save order info to storage
            orderSaveStart(pool))),
    ).subscribe(
        //start grid stragy
        ()=> gridStart(pool),
        err => getLogger().error(err)
    )
     
    appendHistoryKlines(spotMarketPool)
}

if (awsParams.key) {
    main()
} else {
    const promiseArr = []
    promiseArr.push({
        type: 'input',
        name: 'apiId',
        message: 'Please input api id:\n'
    })
    promiseArr.push({
        type: 'password',
        name: 'apiKey',
        message: 'Please input api key:\n'
    })

    from(inquirer.prompt(promiseArr)).pipe(
        tap(data => {
            awsParams.id = data.apiId
            awsParams.key = data.apiKey
        })).subscribe(() => main())
}