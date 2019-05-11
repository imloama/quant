import {
    Subject,
    from
} from 'rxjs'
import {
    filter,
    flatMap,
    map,
    take,
    toArray
} from 'rxjs/operators'

const klineSub = function klineSub (pool, symbol, period = '1min') {

    const sub = `market.${symbol}.kline.${period}`

    pool.send({
        sub
    })

    return pool.messageQueue.pipe(
        filter(data => data.ch === sub),
        map(data => {
            data.tick.ts = data.ts
            return data.tick
        })
    )

}

const marketDepthSub = function marketDepthSub (pool, symbol, step = 0) {
    const sub = `market.${symbol}.depth.step${step}`
    pool.send({
        sub
    })

    return pool.messageQueue.pipe(
        filter(data => data.ch === sub),
        map(data => data.tick)
    )
}

//max reponse size is 300
const klineReq = function klineReq (pool, symbol, period = '1day', begin, end) {
    const req = `market.${symbol}.kline.${period}`

    const params = {
        req
    }

    if (begin) {
        params.from = begin
    }
    if (end) {
        params.to = end
    }

    pool.send(params)

    const subject = new Subject()

    pool.messageQueue.pipe(
        filter(data => data.rep === req),
        take(1),
        flatMap(data => from(data.data).pipe(
            map(data => {
                data.ts = data.id
                Reflect.deleteProperty(data, 'id')

                data.symbol = symbol
                data.period = period
                return data
            }),
            toArray()
        ))).subscribe(subject)

    return subject
}

/*
 * const marketObservable = function marketObservable (messageObservable, topic) {
 *     return messageObservable.pipe(
 *         operators.filter(data => data.ch === topic),
 *         operators.map(data => ({
 *             ch: data.ch,
 *             ts: data.tick.ts,
 *             bid: {
 *                 price: data.tick.bids[0][0],
 *                 amount: data.tick.bids[0][1]
 *             },
 *             ask: {
 *                 price: data.tick.asks[0][0],
 *                 amount: data.tick.asks[0][1]
 *             }
 *         })),
 *         // operators.tap(data => getLogger().info(data)),
 *     )
 * }
 */


module.exports = {
    klineSub,
    marketDepthSub,
    klineReq
}