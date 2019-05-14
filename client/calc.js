import {filter, flatMap, map, repeat, tap, toArray, zip} from 'rxjs/operators';
import {from, of} from 'rxjs';

import bigNumber from 'bignumber.js'

const getRate = function getRate (startPrice, endPrice, gridCount){
    const sPrice = bigNumber(startPrice)
    const ePrice = bigNumber(endPrice)
    const gCount = parseInt(gridCount)

    if (sPrice.gte(ePrice)){
        throw new Error('start price is higher than end price')
    }
    if(gCount <=0){
        throw new Error('grid count should greater than 0')
    }
    
    const rate = bigNumber(Math.pow(ePrice.div(sPrice), 1/gCount) - 1)

    return rate
}

//eslint-disable-next-line
const getGridPrices = function getGridPrices (startPrice, endPrice, rate, gridCount, precision = 4){

    const sPrice = bigNumber(startPrice)
    const ePrice = bigNumber(endPrice)
    const gCount = parseInt(gridCount)
    const gRate = bigNumber(rate)

    let gridPrices = []
    gridPrices.push(sPrice)

    of(1).pipe(
         repeat(gCount-1),
         map(()=> gridPrices[gridPrices.length - 1].times(gRate.plus(1))),
         tap(data => gridPrices.push(data)),
         toArray(),
         flatMap(() => from(gridPrices)),
         map(data => data.toFixed(precision)),
         toArray()
    ).subscribe(data => {
        gridPrices  = data
    }, err => console.error(err))

    gridPrices.push(ePrice.toFixed(precision))

    return gridPrices
}

module.exports = {
    getRate,
    getGridPrices
}