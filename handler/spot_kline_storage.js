import {
    Subject,
    from,
    timer
} from 'rxjs'
import {order as apiOrder, spotMarket} from '../api';
import {
    concatMap,
    distinct,
    filter,
    map,
    mergeMap,
    mergeMapTo,
    throttleTime,
    toArray
} from 'rxjs/operators';

import config from '../config'
import {types} from '../base';

const batchSaveOrUpdateOrders = function batchSaveOrUpdateOrders (klines) {
    return from(klines).pipe(
        concatMap(kline => from(
           types.Kline.findCreateFind({
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
    return from(types.sequelize.query(`select ifnull(min(ts), 0) as min, 
                                        ifnull(max(ts), 0) as max from klines 
                                 where symbol = "${symbol}" and period = "${period}"`))
            .pipe(
                map(data => {
                    const result = {
                        max: parseInt(data[0][0].max),
                        min: parseInt(data[0][0].min)
                    }

                    if(result.min === 0){
                        result.min = new Date().getMilliseconds/1000
                    }

                    if(result.max === 0){
                        result.max = new Date().getMilliseconds/1000
                    }

                    return result
                }),
                map(data => [
                    {
                        end: data.min - 1
                    },
                    {
                        begin: data.max
                    }
                ]),
            mergeMap(data => from(data)),
        concatMap(data =>spotMarket.klineReq(pool, symbol, period, data.begin, data.end)),
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
        throttleTime(config.klineReqInterval), 
    ).subscribe(() => timer(config.klineReqInterval).pipe().subscribe(()=>timely.next(1)))
    
    timely.next(1)
}

const appendHistoryKlines = function appendHistoryKlines (pool) {
    const symbolPeriodObs =  apiOrder.openOrderReqByHttp().pipe(
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