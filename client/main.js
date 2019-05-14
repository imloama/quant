import {Tasks, init} from '../base/types'
import {filter, flatMap, map, mergeMap, tap} from 'rxjs/operators';
import {getGridPrices, getRate} from './calc'

import BigNumber from 'bignumber.js';
import {from} from 'rxjs';
import inquirer from 'inquirer'

const main = function main (){
     //input params
    const promiseArr = [
        {
            type: 'input',
            name: 'symbol',
            message: 'Please input trade symbol:\n'
        },
        {
            type: 'input',
            name: 'start-price',
            message: 'Please input start price:\n'
        },
        {
            type: 'input',
            name: 'end-price',
            message: 'Please input end price:\n'
        },
        {
            type: 'input',
            name: 'grid-count',
            message: 'Please input grid count:\n'
        },
        {
            type: 'input',
            name: 'grid-amount',
            message: 'Please input amount for every grid:\n'
        }

    ]

    const inputParamsCalcObservable = from(inquirer.prompt(promiseArr)).pipe(
          map(params => {
              const rate = getRate(params['start-price'], params['end-price'], params['grid-count'])
              params['grid-rate'] =rate.toFixed(4)
              return params 
          }),
          flatMap(data => from(inquirer.prompt([
              {
                  type: 'confirm',
                  name: 'confirm',
                  message: `Calculate rate result is:${data['grid-rate']}, including trade fee. 
     Every grid finished you can earn ${new BigNumber(data['grid-amount']).times(new BigNumber(data['grid-rate']))}. 
     Would you like to continue?`,
                  default: false 
              }
          ])).pipe(tap(newData => {newData.org = data}))),
          filter(data => data.confirm),
          map(data => {
              const result = data.org
              const gridPrices =  getGridPrices(data.org['start-price'], data.org['end-price'], data.org['grid-rate'], data.org['grid-count'], 5)
              result['grid-prices'] = gridPrices.join(',')
              result.state = 1
              return result
          })
         )

     //save task into db

    init()

    inputParamsCalcObservable.pipe(
         map(data => Tasks.build(data)),
         mergeMap(data => from(data.save()))
    ).subscribe(data =>{
        console.log(data.dataValues)
        console.log('Task has built successfully.')
    }, err => console.error(err))


     /*
      *get current price. 
      *calc order info
      *calc balance need
      *if ok. submit order
      */
}

main()