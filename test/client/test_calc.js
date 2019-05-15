import * as assert from 'assert'

import{describe, it} from 'mocha'
import {getGridPrices, getRate} from '../../client/calc'

import BigNumber from 'bignumber.js';

describe('test calc', ()=>{
    it('getRate', ()=>{
        assert.throws(()=> getRate(1.0, 0, 2), Error, new Error('start price is higher than end price'))
        assert.throws(()=> getRate(1, 1, 2), Error, new Error('start price is higher than end price'))
        assert.throws(()=> getRate(1.0, 2, 0), Error, new Error('grid count should greater than 0'))
        assert.throws(()=> getRate(1.0, 2, -1), Error, new Error('grid count should greater than 0'))

        assert.equal(getRate(1.0, 2.25, 2).toFixed(4), 0.5)

        assert.equal(getRate(2.0, 4.0, 1).toFixed(4), 1)
        assert.equal(getRate(1.0, 2.25, 2).toFixed(4), 0.5)

    })
    it('getGridPrices', ()=>{
        const rate = getRate(1, 5, 20)
        const gridPrices =  getGridPrices(1, 5, rate, 20, 4)
        assert.equal(gridPrices.length, 21)
        gridPrices.forEach((price, i) => {
            if(i>0){
                assert.equal(new BigNumber(price).toFixed(4), new BigNumber(gridPrices[0]).times(rate.plus(1).pow(i)).toFixed(4))
            } 
        });
        // console.log(gridPrices)
    })

    /*
     * it('calculate', ()=>{
     *     calculate({
     *         sPrice: 2.20,
     *         ePrice: 2.60,
     *         gridCount: 30
     */

    /*
     *     })
     * })
     */
})