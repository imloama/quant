import {
    pool,
    start as poolStart
} from './connection/spot_pool'

import {
    EMPTY_ERR_HANDLER
} from './base/const'
import {
    awsParams
} from './config';
import {
    start as balanceStart
} from './handler/account_balance'
import {
    from
} from 'rxjs';
import inquirer from 'inquirer'
import {
    start as orderSaveStart
} from './handler/order_storage'
import {
    sendAuth
} from './api/account'
import {
    tap
} from 'rxjs/operators';

const main = function main () {
    //start message pool
    poolStart()

    //send auth message
    const authPassedSubject = sendAuth(pool)

    //req account info and sub account change
    authPassedSubject
        .subscribe(
            () => balanceStart(pool),
            EMPTY_ERR_HANDLER
        )


    authPassedSubject.subscribe(
        () => orderSaveStart(pool),
        EMPTY_ERR_HANDLER
    )
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