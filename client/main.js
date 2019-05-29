import {Tasks, init} from '../base/types'
import {filter, mergeMap, take, flatMap, map, reduce, concatMap} from 'rxjs/operators';
import {getGridPrices, getRate} from './calc'

import BigNumber from 'bignumber.js';
import {from} from 'rxjs';
import inquirer from 'inquirer'
import MarketAPI from '../api/spot_market';
import config from '../config'
import AccountAPI from '../api/account';
import {getSymbolInfo} from '../base/common';

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

const calcBalance = async function calcBalance (symbol, gridPrices, gridAmount, curPriceStr){
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

    const balanceMap = await AccountAPI.getAccountInfoByHttp().pipe(
            flatMap(datas => from(datas)),
            filter(data => data.type === 'spot'),
            take(1),
            map(data => data.id),
            concatMap(id => AccountAPI.getAccountBalanceByHttp(id)),
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

    const symbolInfo = await from(inquirer.prompt({
        type: 'input',
        name: 'symbol',
        message: 'Please input trade symbol:\n'
    })).pipe(
        mergeMap(data => MarketAPI.getAllSymbolInfosByHttp().pipe(
                    mergeMap(symbols => from(symbols)), 
                    filter(symbol => symbol.symbol === data.symbol),
                    take(1)
                )
            ),
    ).toPromise()

    const curMarketInfo = await MarketAPI.marketMergedDetailByHttp(symbolInfo.symbol).toPromise()

    const inputInfos = await priceAndAmountPrompt(symbolInfo, curMarketInfo)

    inputInfos.symbol = symbolInfo.symbol
    inputInfos['grid-rate'] = getRate(inputInfos['start-price'], inputInfos['end-price'], inputInfos['grid-count']).toFixed(4)

    const gridPrices =  getGridPrices(inputInfos['start-price'], inputInfos['end-price'], inputInfos['grid-rate'],
                                      inputInfos['grid-count'], symbolInfo['price-precision'])
    inputInfos['grid-prices'] = gridPrices.join(',')

    //check account balance enough
    if(config.awsParams.key) {
        const result = await calcBalance(inputInfos.symbol, inputInfos['grid-prices'].split(','), inputInfos['grid-amount'], curMarketInfo.close)
        if(!result){
            return 'no enough balance'
        }
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

     //save task into db
    init()

    inputInfos.state = 1

    const data = await Tasks.build(inputInfos)
    await data.save()

    return 'Task has built successfully'
}

main().then(console.log).catch(err => console.error(err))