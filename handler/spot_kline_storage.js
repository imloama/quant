import {
    Kline,
    sequelize
} from '../base/types'
import {
    Subject,
    from,
    timer
} from 'rxjs'
import {
    concatMap,
    distinct,
    filter,
    map,
    mergeMap,
    mergeMapTo,
    tap,
    throttleTime,
    toArray
} from 'rxjs/operators';

import {getLogger} from 'log4js';
import {
    klineReq
} from '../api/spot_market'
import{
    klineReqInterval
} from '../config'
import {openOrderReqByHttp} from '../api/order'

const batchSaveOrUpdateOrders = function batchSaveOrUpdateOrders (klines) {
    return from(klines).pipe(
        concatMap(kline => from(
            Kline.findCreateFind({
                where: {
                    'symbol': kline.symbol,
                    'period': kline.period,
                    'ts': kline.ts
                },
                defaults: kline
            })
        )),
        toArray(),
    )
}

const autoFillHistoryInfo = function autoFillHistoryInfo (pool, symbol, period) {
    //查看数据库中的情况
    return from(sequelize.query(`select ifnull(min(ts), strftime("%s", "now")) as min, 
                                        ifnull(max(ts), strftime("%s","now")) as max from klines 
                                 where symbol = "${symbol}" and period = "${period}"`)).pipe(
        map(data => [
            {
                end: parseInt(data[0][0].min)
            },
            {
                begin: parseInt(data[0][0].max)
            }
        ]),
        mergeMap(data => from(data)),
        concatMap(data => klineReq(pool, symbol, period, data.begin, data.end)),
        concatMap(datas => batchSaveOrUpdateOrders(datas))
    )
}

let fillHistorySubscription = null

const timely = new Subject()

const autoFillHistoryInfoTimely = function autoFillHistoryInfoTimely (pool, arrSymbolPeriod) {
    if (fillHistorySubscription) {
        fillHistorySubscription.unsubscribe()
    }
   
    fillHistorySubscription = timely.pipe(
        mergeMapTo(from(arrSymbolPeriod)),
        concatMap(symbolPeriod => autoFillHistoryInfo(pool, symbolPeriod.symbol, symbolPeriod.period)),
        throttleTime(klineReqInterval),
    ).subscribe(() => timer(klineReqInterval).pipe().subscribe(()=>timely.next(1)))
    
    timely.next(1)
}

const appendHistoryKlines = function appendHistoryKlines (pool) {
    const symbolPeriodObs = openOrderReqByHttp().pipe(
        mergeMap(data => from(data)),
        map(data => data.symbol),
        distinct(),
        map(symbol => ({
            symbol,
            period: '4hour'
        })),
        toArray()
    )
    pool.messageQueue.pipe(
        filter(data => data.messageType === 'open'),
        mergeMap(()=> symbolPeriodObs),
    ).subscribe(arrSymbolPeriod => autoFillHistoryInfoTimely(pool, arrSymbolPeriod))
}


module.exports = {
    appendHistoryKlines
    // autoFillHistoryInfoTimely
}