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
    throttleTime,
    toArray,
    delay
} from 'rxjs/operators';

import config from '../config'
import {
    types
} from '../base';
import OrderAPI from '../api/order';
import MarketAPI from '../api/spot_market';


export default class SpotKlineStorage {

    constructor () {
        this.fillHistorySubscription = null

        this.timely = new Subject()
    }

    static batchSaveOrUpdateOrders (klines) {
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

    static autoFillHistoryInfo (pool, symbol, period) {
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

                    if (result.min === 0) {
                        result.min = new Date().getMilliseconds / 1000
                    }

                    if (result.max === 0) {
                        result.max = new Date().getMilliseconds / 1000
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
                concatMap(data => MarketAPI.klineReq(pool, symbol, period, data.begin, data.end).pipe(delay(500))),
                concatMap(datas => SpotKlineStorage.batchSaveOrUpdateOrders(datas))
            )
    }


    autoFillHistoryInfoTimely (pool, arrSymbolPeriod) {
        if (this.fillHistorySubscription) {
            this.fillHistorySubscription.unsubscribe()
        }

        this.fillHistorySubscription = this.timely.pipe(
            mergeMapTo(from(arrSymbolPeriod)),
            concatMap(symbolPeriod => SpotKlineStorage.autoFillHistoryInfo(pool, symbolPeriod.symbol, symbolPeriod.period)),
            throttleTime(config.kilne.reqInterval),
        ).subscribe(() => timer(config.kilne.reqInterval).pipe().subscribe(() => this.timely.next(1)))

        this.timely.next(1)
    }

    appendHistoryKlines (pool) {
        const symbolPeriodObs = OrderAPI.openOrderReqByHttp().pipe(
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
            mergeMap(() => symbolPeriodObs),
        ).subscribe(arrSymbolPeriod => this.autoFillHistoryInfoTimely(pool, arrSymbolPeriod))
    }


}