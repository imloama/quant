import {
    Orders,
    sequelize
} from '../base/types'
import {
    Subject,
    from,
    zip
} from 'rxjs';
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

import Op from 'sequelize/lib/operators'
import {
    OrderState
} from '../base/const';

import {
    getLogger
} from '../base/logger'
import OrderAPI from '../api/order';

export default class OrderStorage {
    constructor () {
        this.orderChangeSubscription = null
    }

    static checkOpenOrderInDB (orderReqSubject) {
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
        return zip(
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
            concatMap(order => OrderAPI.orderDetailReqByHttp(order['order-id'])),
            tap(data => getLogger().info('open history orders result', data)),
            flatMap(data => from(Orders.update(data, {
                where: {
                    'order-id': data['order-id']
                }
            }))),
            toArray()
        )
    }

    //tODO not all history orders. need to improve
    static saveMissedOrders () {
        //query and save orders after last order in db till now.
        return from(sequelize.authenticate()).pipe(
            mergeMapTo(from(Orders.findOne({
                order: [
                    [
                        'order-id',
                        'DESC'
                    ]
                ]
            }))),
            map(data => {
                if (!data) {
                    return {
                        'created-at': 0
                    }
                }
                return data
            }),
            // filter(data => data),
            tap(data => getLogger().info(`prepare to load history after:${data['created-at']}`)),
            flatMap(data => OrderAPI.orderHistoryReqByHttp({
                'start-time': data['created-at'] + 1,
                size: 1000
            })),
            flatMap(data => from(data)),
            concatMap(data => from(Orders.findCreateFind({
                where: {
                    'order-id': data['order-id']
                },
                defaults: data
            }))),
            toArray()
        )
    }

    static saveOpenOrders (orderReqSubject) {
        return zip(orderReqSubject, sequelize.authenticate()).pipe(
            tap(() => getLogger().info('save open orders')),
            flatMap(([data]) => from(data)),
            concatMap(data => from(Orders.findCreateFind({
                where: {
                    'order-id': data['order-id']
                },
                defaults: data
            }))),
            toArray()
        )
    }


    start (pool) {
        getLogger().info('order storage starting...')

        const dbOrderSubject = new Subject()
        //req open orders info by rest api
        const orderReqSubject = new Subject()
        OrderAPI.openOrderReqByHttp().subscribe(orderReqSubject)

        const dbOpenOrderObser = OrderStorage.checkOpenOrderInDB(orderReqSubject)

        const dbSaveMissedOrdersObser = OrderStorage.saveMissedOrders()
        zip(dbOpenOrderObser, dbSaveMissedOrdersObser).pipe(
            mergeMapTo(OrderStorage.saveOpenOrders(orderReqSubject))
        ).subscribe(
            () => {
                dbOrderSubject.next(1)
            },
            err => getLogger().error(err)
        )

        /*
         *sub order change
         */
        if (this.orderChangeSubscription) {
            this.orderChangeSubscription.unsubscribe()
        }
        this.orderChangeSubscription = orderReqSubject.pipe(
            take(1),
            flatMap(data => from(data)),
            map(data => data.symbol),
            distinct(),
            toArray(),
            flatMap(symbols => OrderAPI.orderSub(pool, symbols)),
            // tap(data => getLogger().info(JSON.stringify(data)))
        ).subscribe(data => Orders.upsert(data))

        return dbOrderSubject
    }
}