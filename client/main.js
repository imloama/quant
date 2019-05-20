import {Tasks, init} from '../base/types'
import {filter, mergeMap, take} from 'rxjs/operators';
import {getGridPrices, getRate} from './calc'

import BigNumber from 'bignumber.js';
import {from} from 'rxjs';
import inquirer from 'inquirer'
import MarketAPI from '../api/spot_market';


const priceAndAmountPrompt = function priceAndAmountPrompt (symbolInfo){
     //input params
    const promiseArr = [
        {
            type: 'input',
            name: 'start-price',
            message: `Please input start price (Precision:${symbolInfo['price-precision']} ):\n`
        },
        {
            type: 'input',
            name: 'end-price',
            message: `Please input end price (Precision:${symbolInfo['price-precision']}):\n`
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

    const inputInfos = await priceAndAmountPrompt(symbolInfo)

    inputInfos.symbol = symbolInfo.symbol
    inputInfos['grid-rate'] = getRate(inputInfos['start-price'], inputInfos['end-price'], inputInfos['grid-count']).toFixed(4)

    const gridPrices =  getGridPrices(inputInfos['start-price'], inputInfos['end-price'], inputInfos['grid-rate'],
                                      inputInfos['grid-count'], symbolInfo['price-precision'])
    inputInfos['grid-prices'] = gridPrices.join(',')
    inputInfos.state = 1
    const confirm = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Calculate rate result is:${inputInfos['grid-rate']}, with trading fee included. 
     Every grid finished you can earn ${new BigNumber(inputInfos['grid-amount']).times(new BigNumber(inputInfos['grid-rate']))}. 
     Would you like to continue?`,
        default: false 
    })

    if(!confirm){
        return
    }

     //save task into db
    init()

    const data = await Tasks.build(inputInfos)
    await data.save()
}

main().then(()=> console.log('Task has built successfully')).catch(err => console.error(err))