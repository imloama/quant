import {
    from,
    zip
} from 'rxjs';
import {
    logger,
    types
} from './base';
import {
    mergeMap,
    tap
} from 'rxjs/operators';

import SpotAccount from './connection/spot_pool';
import SpotMarket from './connection/spot_market_pool';

import {
    awsParams
} from './config';
import AccountBalance from './handler/account_balance'
import {
    getLogger
} from 'log4js';

import inquirer from 'inquirer'
import OrderStorage  from './handler/spot_order_storage'
import AccountAPI from './api/account';
import SpotKlineStorage from './handler/spot_kline_storage';
import Grid from './handler/grid';


const main = function main () {
    logger.init()
    //初始化数据库信息
    types.init()

    //start message pool
    const spotMarketPool = new SpotMarket()
    spotMarketPool.start()

    const spotAccountPool = new SpotAccount()
    spotAccountPool.start()

    //send auth message
    const accountAPI = new AccountAPI()
    const authPassedSubject = accountAPI.sendAuth(spotAccountPool)

    const account = new AccountBalance()
    const orderStorage = new OrderStorage()

    authPassedSubject.pipe(
        mergeMap(() => zip(
            //req account info and sub account change
            account.start(spotAccountPool),
            //save order info to storage
            orderStorage.start(spotAccountPool),
        ))
    ).subscribe(
        //start grid stragy
        () => new Grid(account).start(spotAccountPool),
        err => getLogger().error(err)
    )

    new SpotKlineStorage().appendHistoryKlines(spotMarketPool)
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