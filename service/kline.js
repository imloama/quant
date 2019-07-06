import Sequelize from 'sequelize'
import {filter, mergeMap, map, toArray, take, expand, max, reduce, tap, mapTo, retry, catchError} from 'rxjs/operators';
import {from, zip, Observable, empty, EMPTY, merge, of, race, timer, throwError} from 'rxjs';
import {getLogger} from 'log4js';

export default class KLine {
    constructor (pool, sequelize){
        this.pool = pool
        this.DBTable = KLine.initDB(sequelize)
        this.DBTable.sync({
            force: false 
        })
    }

    static initDB (sequelize) {
        return sequelize.define('kline', {
            'symbol': {
                type: Sequelize.STRING
            },
            'period': {
                type: Sequelize.STRING
            },
            'amount': {
                type: Sequelize.DECIMAL(30, 8)
            },
            'count': {
                type: Sequelize.INTEGER
            },
            'ts': {
                type: Sequelize.INTEGER
            },
            'open': {
                type: Sequelize.DECIMAL(30, 8)
            },
        
            'close': {
                type: Sequelize.DECIMAL(30, 8)
            },
        
            'low': {
                type: Sequelize.DECIMAL(30, 8)
            },
        
            'high': {
                type: Sequelize.DECIMAL(30, 8)
            },
        
            'vol': {
                type: Sequelize.DECIMAL(30, 8)
            }
        
        }, {
            indexes: [
                {
                    unique: true,
                    fields: [
                        'symbol',
                        'period',
                        'ts'
                    ]
                }
            ]
        })    
    }

    reqKlineInfo (symbol, period = '1day', begin, end) {
        const req = `market.${symbol}.kline.${period}`
        const id = Math.floor(Math.random() * 1000000).toString() 

        const params = {
            req,
            id
        }

        if (begin) {
            params.from = begin
        }

        if (end) {
            params.to = end
        }

        this.pool.send(params)

        return race(
            this.pool.messageQueue.pipe(
                filter(data => data.rep === req && data.id === id),
                //or it will never end
                take(1),
                mergeMap(data => from(data.data)),
                map(data => {
                    data.ts = data.id
                    Reflect.deleteProperty(data, 'id')

                    data.symbol = symbol
                    data.period = period

                    return data
                }),
                toArray(),
            ),
            timer(3000).pipe(
                tap(() => getLogger().warn(`req ${req} failed`)),
                throwError(`req ${req} timeout`),
                // mapTo([])
            )
        ).pipe(
            retry(2),
            catchError(() => of([]))
        ).toPromise()
    }

    // 1min, 5min, 15min, 30min, 60min, 1day, 1mon, 1week, 1year
    async syncKlineInfo (symbol, period) {
        getLogger().debug(`start sync ${symbol}:${period} kline info`)
        
        const timeRange = await zip(
                from(this.DBTable.min('ts', {where: {
                    symbol,
                    period
                }})),
                from(this.DBTable.max('ts', {where: {
                    symbol,
                    period
                }}))
            ).pipe(
                map(([
                    min,
                    max
                    ]) => {
                    const result = {}
                    if(min){
                        result.minTs = min
                    }else {
                        result.minTs = Math.floor(Date.now() / 1000)
                    }

                    if(max){
                        result.maxTs = max
                    }else {
                        result.maxTs = Math.floor(Date.now() / 1000)
                    }
                    return result
                }),
            ).toPromise()
       
        
        await merge(
                from(this.reqKlineInfo(symbol, period, null, timeRange.minTs - 1)).pipe(
                    // query left
                    expand(klines => klines.length === 0 
                        ? EMPTY
                        : from(this.reqKlineInfo(symbol, period, 0, klines[0].ts - 1))),
                ),
                from(this.reqKlineInfo(symbol, period, timeRange.maxTs + 1)).pipe(
                    // query right
                    expand(klines => klines.length === 0 
                        ? EMPTY
                        : from(this.reqKlineInfo(symbol, period, klines[klines.length - 1].ts + 1))),
                )
            ).pipe(
                reduce((acc, val)=> acc.concat(val), []),
                mergeMap(klines => this.DBTable.bulkCreate(klines, {
                    updateOnDuplicate: [
                        'symbol',
                        'period',
                        'ts'
                    ]
                }))   
        ).toPromise()
    }
}