import * as assert from 'assert'

import{describe, it} from 'mocha'

import{getSymbolInfo} from '../../base/common'

describe('test common.js', ()=>{
    it('getSymbolInfo', ()=>{
        assert.deepEqual(getSymbolInfo('htusdt'), {base: 'usdt',
            trader: 'ht'})

        assert.deepEqual(getSymbolInfo('usdthusd'), {base: 'husd',
            trader: 'usdt'})

        assert.deepEqual(getSymbolInfo('btcusdt'), {base: 'usdt',
            trader: 'btc'})

        assert.deepEqual(getSymbolInfo('htxrp'), null)
    })
})