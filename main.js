import {
    from,
    of
} from 'rxjs';
import {
    logger
} from './base';
import {
    tap,
    delay
} from 'rxjs/operators';

import SpotAccount from './connection/spot_pool';

import {
    awsParams,
    db
} from './config';
import {
    getLogger
} from 'log4js';

import inquirer from 'inquirer'
import process from 'process'
import Auth from './service/auth';
import Order from './service/order';
import Sequelize from 'sequelize'
import Account from './service/account';
import Grid from './strategy/grid';


const main = function main () {
    logger.init()

    const sequelize = new Sequelize(db.database, db.username, db.password, {
        dialect: db.type,
        operatorsAliases: false,
        logging: false,

        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },

    // 仅限 SQLite
        storage: db.storage
    });

    //start message pool
    const spotAccountPool = new SpotAccount()
    spotAccountPool.start()

    const authService = new Auth(awsParams.id, awsParams.key)
    const orderService = new Order(sequelize, spotAccountPool, authService)
    const accountService = new Account(authService)

    const grid = new Grid(sequelize, authService, orderService, accountService) 

    authService.sendAuth(spotAccountPool).subscribe(
        ()=> grid.start(),
        err => getLogger().error(err)
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

process.on('uncaughtException', err => {
    getLogger().error(err)
    of(1).pipe(delay(3000)).subscribe(()=>process.exit(0))
})