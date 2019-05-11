import {
    appendHistoryKlines
} from './handler/spot_kline_storage'
import {
    awsParams
} from './config';
import {
    start as balanceStart
} from './handler/account_balance'
import {
    from
} from 'rxjs';
import {
    init
} from './base/types'
import inquirer from 'inquirer'
import logger from './base/logger'
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
import {
    tap
} from 'rxjs/operators';

const main = function main () {
    logger.init()
    //初始化数据库信息
    init()

    //start message pool
    spotMarketPool.start()
    pool.start()

    
      //send auth message
    const authPassedSubject = sendAuth(pool)

    
     //req account info and sub account change
    authPassedSubject.subscribe(() => balanceStart(pool))

    
      //save order info to storage
    authPassedSubject.subscribe(() => orderSaveStart(pool))
     

    // appendHistoryKlines(spotMarketPool)
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