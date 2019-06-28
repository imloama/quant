import {filter, mergeMap, take, flatMap, map, reduce, concatMap} from 'rxjs/operators';
import {getGridPrices, getRate} from './calc'

import BigNumber from 'bignumber.js';
import {from} from 'rxjs';
import inquirer from 'inquirer'
import config from '../config'
import {getSymbolInfo} from '../base/common';
import Grid from '../strategy/grid';
import Sequelize from 'sequelize'
import Account from '../service/account';
import Auth from '../service/auth';
import market from '../service/market';

const priceAndAmountPrompt = function priceAndAmountPrompt (symbolInfo, marketInfo){
     //input params
    const promiseArr = [
        {
            type: 'input',
            name: 'start-price',
            message: `Please input start price (Cur price:${marketInfo.close}, Precision:${symbolInfo['price-precision']} ):\n`
        },
        {
            type: 'input',
            name: 'end-price',
            message: `Please input end price (Cur price:${marketInfo.close}, Precision:${symbolInfo['price-precision']}):\n`
        },
        {
            type: 'input',
            name: 'grid-count',
            message: 'Please input grid count:\n'
        },
        {
            type: 'input',
            name: 'grid-amount',
            message: `Please input amount for every grid(Precision:${symbolInfo['amount-precision']}):\n`
        }
    ]

    return inquirer.prompt(promiseArr)
}

const calcBalance = async function calcBalance (accountService, symbol, gridPrices, gridAmount, curPriceStr){
    const curPrice = new BigNumber(curPriceStr)
    const needBalanceMap = new Map()
    const symbolInfo = getSymbolInfo(symbol)

    needBalanceMap.set(symbolInfo.base, new BigNumber(0))
    needBalanceMap.set(symbolInfo.trader, new BigNumber(0))

    gridPrices.forEach(item => {
        const price = new BigNumber(item) 
        if(price.gte(curPrice)){
            needBalanceMap.set(symbolInfo.trader, needBalanceMap.get(symbolInfo.trader).plus(new BigNumber(gridAmount)))
        }else {
            needBalanceMap.set(symbolInfo.base, needBalanceMap.get(symbolInfo.base).plus(new BigNumber(gridAmount).times(price)))
        }
    });

    const account = await accountService.getAccountByType('spot')

    const balanceMap = await from(accountService.getBalance(account)).pipe(
            flatMap(data => from(data.list)),
            filter(data => data.type === 'trade'),
            reduce((acc, value)=>{
                acc.set(value.currency, value.balance); 
                return acc
            }, new Map())
        ).toPromise()

    console.log(`need ${symbolInfo.base} ${needBalanceMap.get(symbolInfo.base)} got ${balanceMap.get(symbolInfo.base)} \n, need ${symbolInfo.trader} ${needBalanceMap.get(symbolInfo.trader)} got ${balanceMap.get(symbolInfo.trader)}`)

    return new BigNumber(balanceMap.get(symbolInfo.base)).gte(needBalanceMap.get(symbolInfo.base)) &&  
        new BigNumber(balanceMap.get(symbolInfo.trader)).gte(needBalanceMap.get(symbolInfo.trader))
}

const main = async function main (){
    //input aws key
    if(!config.awsParams.key || !config.awsParams.id){
        config.awsParams.id = await inquirer.prompt({
            type: 'input',
            name: 'apiId',
            message: 'Please input api id:\n'
        }).then(data => data.apiId)

        config.awsParams.key = await inquirer.prompt({
            type: 'password',
            name: 'apiKey',
            message: 'Please input api key:\n'
        }).then(data => data.apiKey)
    }

     //save task into db
    const sequelize = new Sequelize(config.db.database, config.db.username, config.db.password, {
        dialect: config.db.type,
        operatorsAliases: false,
        logging: false,

        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
    const authService = new Auth(config.awsParams.id, config.awsParams.key)
    const accountService = new Account(authService)
    const grid = new Grid(sequelize, authService, null, accountService)


    const symbolInfo = await from(inquirer.prompt({
        type: 'input',
        name: 'symbol',
        message: 'Please input trade symbol:\n'
    })).pipe(
        mergeMap(data => from(market.getAllSymbolInfos()).pipe(
                    mergeMap(symbols => from(symbols)), 
                    filter(symbol => symbol.symbol === data.symbol),
                    take(1)
                )
            ),
    ).toPromise()

    const curMarketInfo = await market.getMergedDetail(symbolInfo.symbol)

    const inputInfos = await priceAndAmountPrompt(symbolInfo, curMarketInfo)

    inputInfos.symbol = symbolInfo.symbol
    inputInfos['grid-rate'] = getRate(inputInfos['start-price'], inputInfos['end-price'], inputInfos['grid-count']).toFixed(4)

    const gridPrices =  getGridPrices(inputInfos['start-price'], inputInfos['end-price'], inputInfos['grid-rate'],
                                      inputInfos['grid-count'], symbolInfo['price-precision'])
    inputInfos['grid-prices'] = gridPrices.join(',')

    //check account balance enough
    const result = await calcBalance(accountService, inputInfos.symbol, inputInfos['grid-prices'].split(','), inputInfos['grid-amount'], curMarketInfo.close)
    if(!result){
        return 'no enough balance'
    }

    const confirm = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Calculate rate result is:${inputInfos['grid-rate']}, with trading fee included. 
     Every grid finished you can earn ${new BigNumber(inputInfos['grid-amount']).times(new BigNumber(inputInfos['grid-rate']))}. 
     Would you like to continue?`,
        default: false 
    })

    if(!confirm.confirm){
        return 'Task is canceled'
    }

    inputInfos.state = 1

    const data = await grid.DBTask.build(inputInfos)
    await data.save()

    return 'Task has built successfully'
}

main().then(console.log).catch(err => console.error(err))