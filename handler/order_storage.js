import {
    Orders,
    init,
    sequelize
} from '../base/types'
import {
    concatMap,
    distinct,
    filter,
    flatMap,
    map,
    mergeMapTo,
    share,
    take,
    tap,
    toArray
} from 'rxjs/operators';
import {
    from,
    zip
} from 'rxjs';
import {
    openOrderReq,
    orderDetailReq,
    orderHistory,
    orderSub
} from '../api/order'

import {
    EMPTY_ERR_HANDLER
} from '../base/const'
import Op from 'sequelize/lib/operators'

const start = function start (pool) {
    //初始化数据库信息
    init()

    //req order info by rest
    const orderReqSubject = openOrderReq()

    //req order history by rest from last 
    const openOrdersInDB = from(sequelize.authenticate()).pipe(
        mergeMapTo(from(Orders.findAll({
            where: {
                [Op.not]: {
                    'order-state': 'filled'
                }
            }
        }))),
        share()
    )

    //load history orders
    const sub1 = openOrdersInDB.pipe(
        tap(data => data.sort((f, s) => s['order-id'] - f['order-id'])),
        flatMap(data => from(data)),
        take(1),
        flatMap(data => orderHistory({
            'start-time': data['created-at'] + 1,
            size: 1000
        })),
        flatMap(data => from(data))
    ).subscribe(
        data => {
            sub1.unsubscribe()

            Orders.findCreateFind({
                where: {
                    'order-id': data['order-id']
                },
                defaults: data
            })

        },
        err => console.error(err)
    )


    /*
     *find out not opend 
     * zip(
     *     orderReqSubject.pipe(flatMap(data => from(data)), map(data => data['order-id']), toArray()),
     *     openOrdersInDB).pipe(
     *     flatMap(([
     *         reqOrder,
     *         dbOrder
     *     ]) => from(dbOrder).pipe(
     *         filter(item => reqOrder.indexOf(item['order-id']) < 0),
     *     )),
     *     tap(data => console.log('open history orders', data['order-id'])),
     *     concatMap(order => orderDetailReq(pool.client, pool.messageQueue, order['order-id'])),
     *     tap(data => console.log('open history orders result', data)),
     *     flatMap(data => from(Orders.update(data, {
     *         where: {
     *             'order-id': data['order-id']
     *         }
     *     })))
     * ).subscribe(
     *     () => {},
     *     err => console.error(err)
     * )
     */

    //save open orders
    const sub3 = zip(orderReqSubject, sequelize.authenticate())
        .pipe(
            flatMap(([data]) => from(data)),
        )
        .subscribe(
            data => {
                sub3.unsubscribe()
                //eslint-disable-next-line
                Orders.findCreateFind({
                    where: {
                        'order-id': data['order-id']
                    },
                    defaults: data
                })
            },
            err => console.error(err))

    //sub order change
    const sub4 = orderReqSubject.pipe(
        take(1),
        flatMap(data => from(data)),
        map(data => data.symbol),
        distinct(),
        toArray(),
        flatMap(symbols => orderSub(pool.client, pool.messageQueue, symbols)),
        tap(data => console.log(JSON.stringify(data)))
    ).subscribe(
        data => {
            Orders.upsert(data)
        },
        () => sub4.unsubscribe()
    )
}

module.exports = {
    start
}