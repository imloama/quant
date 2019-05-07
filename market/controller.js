const rxjs = require('rxjs')
const operators = require('rxjs/operators')
const BigNumber = require('bignumber.js')


//keep heartbeat 
const keepHeartbeat = function keepHeartbeat (messageObservable, client) {
    messageObservable.pipe(
        operators.filter(data => data.ping),
        operators.tap(data => console.log(data)),
    ).subscribe(
        data => {
            client.send(JSON.stringify({
                pong: data.ping
            }))
        })
}

const subMessage = function subMessage (messageObservable, client, sub) {
    messageObservable.pipe(
        operators.take(1),
    ).subscribe(
        () => client.send(JSON.stringify({
            sub
        }))
    )
}

const subKline = function subKline (messageObservable, client, symbol, period = '1min') {
    subMessage(messageObservable, client, `market.${symbol}.kline.${period}`)
}


const subMaketDepth = function subMaketDepth (messageObservable, client, pairs) {
    messageObservable.pipe(
        operators.take(1),
        operators.flatMap(() => rxjs.from(pairs)),
        operators.map(pair => `market.${pair}.depth.step0`)
    ).subscribe(
        data => client.send(JSON.stringify({
            sub: data
        }))
    )
}
const marketObservable = function marketObservable (messageObservable, topic) {
    return messageObservable.pipe(
        operators.filter(data => data.ch === topic),
        operators.map(data => ({
            ch: data.ch,
            ts: data.tick.ts,
            bid: {
                price: data.tick.bids[0][0],
                amount: data.tick.bids[0][1]
            },
            ask: {
                price: data.tick.asks[0][0],
                amount: data.tick.asks[0][1]
            }
        })),
        // operators.tap(data => console.log(data)),
    )
}

const simplifyMarketDepth = function simplifyMarketDepth (messageObservable, pairs) {
    return rxjs.combineLatest(pairs.map(pair => marketObservable(messageObservable, `market.${pair}.depth.step0`))).pipe(
        operators.map(datas => ({
            origin: datas,
            base: datas[0],
            calc: {
                ts: datas[1].ts < datas[2].ts
                    ? datas[1].ts : datas[2].ts,
                bid: {
                    price: new BigNumber(datas[1].bid.price).times(new BigNumber(datas[2].bid.price)).toFixed(8),
                    amount: datas[1].bid.amount * datas[2].bid.amount
                },
                ask: {
                    price: new BigNumber(datas[1].ask.price).times(new BigNumber(datas[2].ask.price)).toFixed(8),
                    amount: datas[1].ask.amount * datas[2].ask.amount
                }
            }
        })),
    )

    /*
     * .subscribe(
     * data => analyizeInfo(data), 
     * err => console.error(err)
     * )
     */
}

module.exports = {
    keepHeartbeat,
    subMaketDepth,
    simplifyMarketDepth,
    subKline,
    subMessage
}