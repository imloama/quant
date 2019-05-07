const operators = require('rxjs/operators')
const BigNumber = require('bignumber.js')

const printOriginInfo = function printOriginInfo (datas){
    datas.forEach(data => {
        console.log(`ch:${data.ch}
    ts:${data.ts}
    bid: price ${data.bid.price}, amount ${data.bid.amount}
    ask: price ${data.ask.price}, amount ${data.ask.amount}`)    
    });
}

const analyze = function analyze (messageObservable) {
    return messageObservable.pipe(
        //calc profit, check profit
        operators.map(data => {
            let diff1 = new BigNumber(data.calc.ask.price).times(new BigNumber(1-0.002)).times(new BigNumber(1-0.002))
                .minus(new BigNumber(data.base.bid.price))

            let diff2 = new BigNumber(data.base.ask.price).times(new BigNumber(1-0.002)).times(new BigNumber(1-0.002))
                .minus(new BigNumber(data.calc.bid.price))

            console.log(`price ${diff1}, ${diff2}`)
            if(diff1.toNumber() > 0){
                let amount = data.calc.ask.amount < data.base.bid.amount
                        ?data.calc.ask.amount
                        :data.base.bid.amount

                data.profit = {
                    direction: 'right',
                    price: diff1.toNumber(),
                    amount
                }

                return data
            }

            if (diff2.toNumber > 0){
                let amount = data.calc.bid.amount < data.base.ask.amount
                        ?data.calc.bid.amount
                        :data.base.ask.amount
                data.profit = {
                    direction: 'left',
                    price: diff2.toNumber(),
                    amount
                }

                return data
            }

            return data
        }),
        operators.filter(data => data.profit && data.profit.price * data.profit.amount > 0.1),
        operators.tap(data => console.log(data.profit)),
    )
}

module.exports = {
    analyze
}