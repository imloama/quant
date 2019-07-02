import {
    from,
    of
} from 'rxjs';
import {
    logger
} from './base';
import {
    tap,
    delay,
    mergeMap,
    concatMap
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
import SpotMarket from './connection/spot_market_pool';
import KLine from './service/kline';
import market from './service/market';


const main =async function main () {
    if(!awsParams.key){
        const promiseArr = [
            {
                type: 'input',
                name: 'id',
                message: 'Please input api id:\n'
            },
            {
                type: 'password',
                name: 'key',
                message: 'Please input api key:\n'
            }
        ]

        const data =  await inquirer.prompt(promiseArr)
        awsParams.id = data.id
        awsParams.key = data.key
    }

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
    
     // start message pool
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
    

    const marketPool = new SpotMarket();
    marketPool.start()
    const klineService = new KLine(marketPool, sequelize)

    from(market.getAllSymbolInfos()).pipe(
        mergeMap(symbols => from(symbols)),
        tap(console.log),
        concatMap(symbol => from(klineService.syncKlineInfo(symbol.symbol, '60min')).pipe(delay(5000)))
    ).subscribe(
        ()=>getLogger().info('done')
    )
    

    /*
     * of(1).pipe(
     *     delay(2000),
     * ).subscribe(
     *    ()=>     klineService.syncKlineInfo('btcusdt', '60min') 
     *    )
     */
}

main()

process.on('uncaughtException', err => {
    getLogger().error(err)
    of(1).pipe(delay(3000)).subscribe(()=>process.exit(0))
})