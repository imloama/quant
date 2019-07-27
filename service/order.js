import Sequelize, {where, Op} from 'sequelize'
import {rest, cons} from '../base';
import {from, empty, of} from 'rxjs';
import {map, flatMap, toArray, concatMap, tap, filter, reduce, mergeMap, expand, delay, takeUntil, takeWhile, zip} from 'rxjs/operators';
import {getLogger} from 'log4js';
import {OrderState} from '../base/const';

export default class Order {
    constructor (sequelize, pool, authService){
        this.auth = authService 

        //init db info
        this.dbTable = Order.initDB(sequelize)
        this.dbTable.sync({
            force: false 
        })

        //ws pool
        this.pool = pool
    }

    static initDB (sequelize) {
        return sequelize.define('order', {
            id: {
                type: Sequelize.INTEGER(11),
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
            },
            'order-id': {
                type: Sequelize.BIGINT
            },
        
            'seq-id': {
                type: Sequelize.BIGINT
            },
            'symbol': {
                type: Sequelize.STRING
            },
        
            'account-id': {
                type: Sequelize.BIGINT
            },
        
            'order-amount': {
                type: Sequelize.STRING
            },
            'order-price': {
                type: Sequelize.STRING
            },
            'created-at': {
                type: Sequelize.BIGINT
            },
            'finished-at': {
                type: Sequelize.BIGINT
            },
            'order-type': {
                type: Sequelize.STRING
            },
        
            'order-source': {
                type: Sequelize.STRING
            },
            'order-state': {
                type: Sequelize.STRING
            },
        
            'role': {
                type: Sequelize.STRING
            },
        
            'price': {
                type: Sequelize.STRING
            },
        
            'filled-amount': {
                type: Sequelize.STRING
            },
        
            'unfilled-amount': {
                type: Sequelize.STRING
            },
        
            'filled-cash-amount': {
                type: Sequelize.STRING
            },
        
            'filled-fees': {
                type: Sequelize.STRING
            }
        }, {
            indexes: [
                {
                    unique: true,
                    fields: ['order-id']
                }
            ]
        })
    }

    //size up to 500
    getOpenOrders (){
        let params = {
            // 'account-id': accountId,
            size: 500
        }

        params = this.auth.addSignature(cons.AccountAPI + cons.OpenOrders,
                cons.GET,
                params)

        return from(rest.get(cons.AccountAPI + cons.OpenOrders, params)).pipe(
            map(data => data.data),
            flatMap(datas => from(datas)),
            map(data => {
                data['order-id'] = data.id
                Reflect.deleteProperty(data, 'id')
                data['order-amount'] = data.amount
                Reflect.deleteProperty(data, 'amount')
                data['order-state'] = data.state
                Reflect.deleteProperty(data, 'state')
                data['order-type'] = data.type
                Reflect.deleteProperty(data, 'type')
                data['order-source'] = data.source
                Reflect.deleteProperty(data, 'source')

                return data
            }),
            toArray(),
        ).toPromise()
    }

    batchCancel (orderIds) {
        const batchIds = []

        while (orderIds.length > 50) {
            batchIds.push(orderIds.slice(0, 51))
            //eslint-disable-next-line
            orderIds = orderIds.slice(51)
        }
        if (orderIds.length > 0) {
            batchIds.push(orderIds)
        }

        const url = cons.AccountAPI + cons.BatchCancelOrder

        return from(batchIds).pipe(
            concatMap(ids => rest.post(url, {
                'order-ids': ids
            }, this.auth.addSignature(url, cons.POST, {}))),
            map(data => data.data.success),
            reduce((acc, value)=> {
                acc.push(value)
                return acc
            }, [])
        ).toPromise()
    }

    // insert or update
    saveOrders (orders) {
        return from(orders).pipe(
            concatMap(order => this.saveOrder(order)),
            toArray()
        ).toPromise()
    }

    // insert or update
    saveOrder (order){
        return from(this.dbTable.findOne({
            where: {
                'order-id': order['order-id'] 
            }
        })).pipe(
            map(item => {
                if(!item) {
                    return this.dbTable.create(order)
                }

                if(item['seq-id'] > order['seq-id']){
                    return of(order) 
                }

                return this.dbTable.update(order, {
                    where: {
                        'order-id': order['order-id']
                    }
                })
            })
        )
    }

    /**
     * @param {Object} options filter options
     *@returns {Array} 
     * example:
     * {
     * where: {
     * 'order-state': {
     * [Op.notIn]: [
     * OrderState.filled,
     * OrderState.canceled
     * ]
     * }
     * }
     * } 
     */
    loadOrdersFromDB (options){
        return from(this.dbTable.findAll(options))
    }

    //sub order change
    orderSub (symbols, filterWithSymbol = false) {
        const symbolMap = new Map()

        from(symbols).pipe(
            tap(symbol => symbolMap.set(symbol, true)),
            // to avoid request too fast error
            concatMap(symbol => of(symbol).pipe(delay(500))),
        ).subscribe(
            symbol => this.pool.send({
                op: cons.SUB,
                topic: `orders.${symbol}`
            }),
            cons.EMPTY_ERR_HANDLER
        )

        return this.pool.messageQueue.pipe(
            filter(msg => msg.op === cons.NOTIFY &&
                msg.topic.includes('orders') &&
                (!filterWithSymbol || symbolMap.get(msg.topic.split('.')[1]))),
            map(data => data.data),
        )
    }

    getOrderDetailInfo (orderId) {
        const url = cons.AccountAPI + cons.Orders + `/${orderId}`

        const params = this.auth.addSignature(url,
                cons.GET,
                {})

        return from(rest.get(url, params)).pipe(
            filter(data => data.status === 'ok'),
            map(data => {
                const result = data.data

                result['order-id'] = result.id
                Reflect.deleteProperty(result, 'id')

                result['order-amount'] = result.amount
                Reflect.deleteProperty(result, 'amount')

                result['order-type'] = result.type
                Reflect.deleteProperty(result, 'type')

                result['order-source'] = result.source
                Reflect.deleteProperty(result, 'source')

                result['order-state'] = result.state
                Reflect.deleteProperty(result, 'state')

                result['filled-amount'] = result['field-amount']
                Reflect.deleteProperty(result, 'field-amount')

                result['filled-cash-amount'] = result['field-cash-amount']
                Reflect.deleteProperty(result, 'field-cash-amount')

                result['filled-fees'] = result['field-fees']
                Reflect.deleteProperty(result, 'field-fees')

                return result
            })
        ).toPromise()
    }

    getRecentOrders (params) {
        const url = cons.AccountAPI + cons.OrderHistory

        const newParams = this.auth.addSignature(url, cons.GET, params)

        return from(rest.get(url, newParams)).pipe(
            flatMap(data => from(data.data)),
            map(data => {
                data['order-id'] = data.id
                Reflect.deleteProperty(data, 'id')

                data['order-amount'] = data.amount
                Reflect.deleteProperty(data, 'amount')

                data['order-state'] = data.state
                Reflect.deleteProperty(data, 'state')

                data['order-type'] = data.type
                Reflect.deleteProperty(data, 'type')

                data['order-source'] = data.source
                Reflect.deleteProperty(data, 'source')

                data['filled-amount'] = data['field-amount']
                Reflect.deleteProperty(data, 'field-amount')

                data['filled-cash-amount'] = data['field-cash-amount']
                Reflect.deleteProperty(data, 'field-cash-amount')

                data['filled-fees'] = data['field-fees']
                Reflect.deleteProperty(data, 'field-fees')


                return data
            }),
            toArray()
        ).toPromise()
    }

    getHistoryOrders (params) {
        const url = cons.AccountAPI + cons.Orders

        const newParams = this.auth.addSignature(url, cons.GET, params)

        return from(rest.get(url, newParams)).pipe(
            flatMap(data => from(data.data)),
            map(data => {
                data['order-id'] = data.id
                Reflect.deleteProperty(data, 'id')

                data['order-amount'] = data.amount
                Reflect.deleteProperty(data, 'amount')

                data['order-state'] = data.state
                Reflect.deleteProperty(data, 'state')

                data['order-type'] = data.type
                Reflect.deleteProperty(data, 'type')

                data['order-source'] = data.source
                Reflect.deleteProperty(data, 'source')

                data['filled-amount'] = data['field-amount']
                Reflect.deleteProperty(data, 'field-amount')

                data['filled-cash-amount'] = data['field-cash-amount']
                Reflect.deleteProperty(data, 'field-cash-amount')

                data['filled-fees'] = data['field-fees']
                Reflect.deleteProperty(data, 'field-fees')


                return data
            }),
            toArray()
        ).toPromise()
    }

    placeOrder (accountID, symbol, price, amount, type){
        return rest.post(cons.AccountAPI + cons.PlaceOrder,
            {
                'account-id': accountID,
                symbol,
                price,
                amount,
                type
            },
            this.auth.addSignature(
                cons.AccountAPI + cons.PlaceOrder,
                cons.POST,
                {}
            ))
    }


    async saveMissedOrders (symbol) {
        await from(this.getRecentOrders({
            symbol,
            size: 1000
        })).pipe(
            map(orders => from(this.saveOrders(orders)))
        ).toPromise()
    }

    async syncOrderInfo (symbol){
        getLogger().info('sync order info...')

        //update order state
        await from(this.loadOrdersFromDB({where: {'order-state': {
            [Op.notIn]: [
                OrderState.filled,
                OrderState.canceled
            ]
        },
            symbol}})).pipe(
            mergeMap(orders => from(orders).pipe(delay(500))),
            concatMap(order => from(this.getOrderDetailInfo(order['order-id']))),
            filter(data => data['order-state'] !== cons.OrderState.submitted),
            toArray(),
            mergeMap(orders => from(this.saveOrders(orders)))
        ).toPromise()

        // find all orders
        await this.saveMissedOrders(symbol)
    }
}