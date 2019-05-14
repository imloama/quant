import {
    Orders,
    sequelize
} from '../base/types'
import {
    concatMap,
    distinct,
    filter,
    flatMap,
    map,
    mergeMapTo,
    take,
    tap,
    toArray
} from 'rxjs/operators';
import {
    from,
    zip
} from 'rxjs';
import {
    openOrderReqByHttp,
    orderDetailReqByHttp,
    orderHistoryReqByHttp,
    orderSub
} from '../api/order'

import Op from 'sequelize/lib/operators'
import {OrderState} from '../base/const';
import {
getLogger
} from '../base/logger'

let orderChangeSubscription = null

const start = function start (pool) {

    //req open orders info by rest api
    const orderReqSubject = openOrderReqByHttp()

    //load orders from db
    const openOrdersInDB = from(sequelize.authenticate()).pipe(
        mergeMapTo(from(Orders.findAll({
            where: {
                'order-state': {
                    [Op.notIn]: [
                        OrderState.filled,
                        OrderState.canceled
                    ]
                }

            }
        }))))

    //find out not opend 
    zip(
        orderReqSubject.pipe(
            flatMap(data => from(data)),
            map(data => data['order-id']),
            toArray()
        ),
        openOrdersInDB
    ).pipe(
        flatMap(([
            reqOrder,
            dbOrder
        ]) => from(dbOrder).pipe(
            filter(item => reqOrder.indexOf(item['order-id']) < 0),
        )),
        tap(data => getLogger().info(`open history orders ${data['order-id']}`)),
        concatMap(order => orderDetailReqByHttp(order['order-id'])),
        tap(data => getLogger().info('open history orders result', data)),
        flatMap(data => from(Orders.update(data, {
            where: {
                'order-id': data['order-id']
            }
        })))
    ).subscribe(
        () => {},
        err => console.error(err)
    )


    //query and save orders after last order in db till now.
    from(sequelize.authenticate()).pipe(
        mergeMapTo(from(Orders.findOne({
            order: [
                [
                    'order-id',
                    'DESC'
                ]
            ]
        }))),
        filter(data => data),
        tap(data => getLogger().info(`prepare to load history after:${data['created-at']}`)),
        flatMap(data => orderHistoryReqByHttp({
            'start-time': data['created-at'] + 1,
            size: 1000
        })),
        flatMap(data => from(data))
    ).subscribe(
        data => {
            Orders.findCreateFind({
                where: {
                    'order-id': data['order-id']
                },
                defaults: data
            })

        },
        err => console.error(err)
    )


    //save open orders
    zip(orderReqSubject, sequelize.authenticate())
        .pipe(
            tap(() => getLogger().info('save open orders')),
            flatMap(([data]) => from(data)),
        ).subscribe(
            data => {
                Orders.findCreateFind({
                    where: {
                        'order-id': data['order-id']
                    },
                    defaults: data
                })
            },
            err => console.error(err))

    //sub order change
    if (orderChangeSubscription) {
        orderChangeSubscription.unsubscribe()
    }
    orderChangeSubscription = orderReqSubject.pipe(
        take(1),
        flatMap(data => from(data)),
        map(data => data.symbol),
        distinct(),
        toArray(),
        flatMap(symbols => orderSub(pool, symbols)),
        // tap(data => getLogger().info(JSON.stringify(data)))
    ).subscribe(data => Orders.upsert(data))
}

module.exports = {
    start
}