import {
    from,
    of,
    zip
} from 'rxjs';

import {
    account as apiAccount
} from '../api';
import {
    concatMap,
    delay,
    distinct,
    filter,
    flatMap,
    map,
    mergeMap,
    share,
    tap,
    toArray
} from 'rxjs/operators';
import {
    cons,
    types
} from '../base';

import BigNumber from 'bignumber.js';
import Op from 'sequelize/lib/operators'
import {
    dingding
} from '../notifier';
import {
    getLogger
} from 'log4js';
import {
    getSymbolInfo
} from '../base/common'
import OrderAPI from '../api/order';
import MarketAPI from '../api/spot_market';

export default class Grid {
    constructor (accountBalance) {
        this.accountBalance = accountBalance
        this.subscriptions = null
    }

    //checkout task 0 closed 1 normal
    static getTasksByState (state) {
        return from(types.sequelize.authenticate()).pipe(
            mergeMap(() => from(types.Tasks.findAll({
                where: {
                    state
                }
            }))),
            share()
        )
    }

    //check task orders state after all orders ready
    static getTaskOpenOrders (taskId) {
        return from(types.sequelize.authenticate()).pipe(
            mergeMap(() => types.Orders.findAll({
                where: {
                    'task-id': taskId,
                    'order-state': {
                        [Op.or]: [
                            cons.OrderState.submitted,
                            cons.OrderState.partialFilled
                        ]
                    }
                }
            })),
        )
    }


    checkAccountBalanceBeforePlaceOrder (placeOrderParams) {
        const balanceNeed = new Map()

        placeOrderParams.forEach(order => {
            const currencies = getSymbolInfo(order.symbol)
            if (!balanceNeed.has(currencies.base)) {
                balanceNeed.set(currencies.base, new BigNumber(0))
            }
            if (!balanceNeed.has(currencies.trader)) {
                balanceNeed.set(currencies.trader, new BigNumber(0))
            }

            if (order.type === cons.OrderType.buyLimit || order.type === cons.OrderType.buyLimitMaker) {
                balanceNeed.set(currencies.base, balanceNeed.get(currencies.base).plus(new BigNumber(order.price).times(new BigNumber(order.amount))))
            } else if (order.type === cons.OrderType.sellLimit || order.type === cons.OrderType.sellLimitMaker) {
                balanceNeed.set(currencies.trader, balanceNeed.get(currencies.trader).plus(new BigNumber(order.amount)))
            } else {
                throw new Error(`unxepected order type:${order}`)
            }
        })

        const accountId = this.accountBalance.getAccountIdByType('spot')
        for (let key of balanceNeed.keys()) {
            const accountBalance = this.accountBalance.account[accountId][key]
            if (!accountBalance) {
                getLogger().warn(`orders need ${key} ${balanceNeed.get(key).toFixed()}, but we have none in our spot account`)
                return false
            }

            if (new BigNumber(accountBalance.available).lt(balanceNeed.get(key))) {
                getLogger().warn(`orders need ${key} ${balanceNeed.get(key).toFixed()}, but we have ${accountBalance.available} in our spot account`)
                return false
            }
        }

        return true
    }

    placeOrdersByTask (task, orders) {
        const gridPrices = task['grid-prices'].split(',')
        const orderPrices = new Map()

        //open order prices
        from(orders).pipe(
            map(order => order.price),
        ).subscribe(price => {
            orderPrices.set(new BigNumber(price).toFixed(8), true)
        })

        const lackPrices = []
        from(gridPrices).pipe(
            filter(price => !orderPrices.get(new BigNumber(price).toFixed(8))),
        ).subscribe(
            price => {
                orderPrices.delete(new BigNumber(price).toFixed(8))
                lackPrices.push(price)
            }
        )

        if (orderPrices.keys > 0) {
            throw new Error(`open orders price: ${orderPrices.keys} not expected`)
        }

        if (lackPrices.length === 0) {
            //wired should be at least one for the gap.
            getLogger().warn(`task ${task} has no lack price for it.`)
        } else {
            getLogger().warn(`task ${task} lack price: ${lackPrices}`)
        }

        //get current price
        return MarketAPI.marketMergedDetailByHttp(task.symbol).pipe(
            map(data => data.close),
            //generate orders to submit
            flatMap(curPrice => from(lackPrices).pipe(
                map(price => ({
                    'account-id': this.accountBalance.getAccountIdByType('spot'),
                    symbol: task.symbol,
                    price: String(price),
                    amount: task['grid-amount'],
                    type: new BigNumber(curPrice).gt(new BigNumber(price))
                        ? cons.OrderType.buyLimitMaker
                        : cons.OrderType.sellLimitMaker
                })))),
            toArray(),
            filter(orders => this.checkAccountBalanceBeforePlaceOrder(orders)),
            mergeMap(orders => from(orders)),
            concatMap(order => OrderAPI.orderPlaceReqByHttp(order)),
            filter(data => data.status === 'ok'),
            map(data => data.data),
            //save into db
            flatMap(orderId => from(types.Orders.upsert({
                'order-id': orderId,
                'task-id': task.id
            }))),
            toArray()
        )
    }

    static getNextPrice (order, gridPrices) {
        let numberGridPrices = []
        gridPrices.forEach(item => numberGridPrices.push(new BigNumber(item)))
        numberGridPrices.sort((a, b) => {
            if (a.gt(b)) {
                return 1
            } else if (a.eq(b)) {
                return 0
            }

            return -1
        })

        let nextPrice = null
        if (order['order-type'] === cons.OrderType.buyLimitMaker) {
            for (let price of numberGridPrices) {
                if (price.gt(new BigNumber(order.price))) {
                    nextPrice = price.toFixed()
                    break
                }
            }

        } else if (order['order-type'] === cons.OrderType.sellLimitMaker) {
            for (let [
                    i,
                    price
                ] of numberGridPrices.entries()) {

                if (price.gte(new BigNumber(order.price))) {
                    if (i > 0) {
                        nextPrice = numberGridPrices[i - 1].toFixed()
                        break
                    }
                }
            }
        } else {
            throw new Error(`unexpcet order type: ${order}`)
        }

        return nextPrice
    }

    static orderSubHandler (order) {
        let taskId = null
        //get orde from db check if is task order
        from(types.Orders.findOne({
            where: {
                'order-id': order['order-id']
            }
        })).pipe(
            filter(data => data['task-id'] > 0),
            mergeMap(data => from(types.Tasks.findOne({
                where: {
                    'id': data['task-id']
                }
            }))),
            filter(data => data),
            concatMap(task => {
                taskId = task.id
                // get task by id check next order price 
                const price = Grid.getNextPrice(order, task['grid-prices'].split(','))
                //check if this pos has order
                return from(types.Orders.findOne({
                    where: {
                        'task-id': taskId,
                        price,
                        'order-state': {
                            [Op.or]: [
                                cons.OrderState.submitted,
                                cons.OrderState.partialFilled
                            ]
                        }
                    }
                })).pipe(
                    filter(data => !data),
                    // place order 
                    mergeMap(() => OrderAPI.orderPlaceReqByHttp({
                        'account-id': apiAccount.getAccountIdByType('spot'),
                        symbol: task.symbol,
                        price,
                        amount: task['grid-amount'],
                        type: order['order-type'] === cons.OrderType.buyLimitMaker
                            ? cons.OrderType.sellLimitMaker
                            : cons.OrderType.buyLimitMaker
                    }))
                )
            }),
            filter(data => data.status === 'ok'),
            map(data => data.data),
            //save into db
            flatMap(orderId => from(types.Orders.upsert({
                'order-id': orderId,
                'task-id': taskId
            }))),
        ).subscribe(
            data => {
                getLogger('debug').debug('task-id is', taskId, 'upsert result:', data)
            },
            err => getLogger().error(err)
        )
    }

    static handleClosedTasks () {
        Grid.getTasksByState(0).pipe(
            mergeMap(tasks => from(tasks)),
            concatMap(task => Grid.getTaskOpenOrders(task.id)),
            mergeMap(orders => from(orders)),
            map(order => order['order-id']),
            toArray(),
            concatMap(orderIds => OrderAPI.orderBatchCancelByHttp(orderIds)),
            flatMap(data => from(data.success)),
            concatMap(orderId => from(types.Orders.update({
                'order-state': cons.OrderState.canceled
            }, {
                where: {
                    'order-id': orderId
                }
            })))
        ).subscribe(
            data => getLogger().info(data),
            err => getLogger().error(err)
        )
    }

    handleOpenTasks (accountPool) {
        if (this.subscriptions) {
            this.subscriptions.unsubscribe()
        }

        //open tasks
        const taskObservable = Grid.getTasksByState(1)

        this.subscriptions = taskObservable.pipe(
            mergeMap(tasks => from(tasks)),
            map(task => task.symbol),
            distinct(),
            toArray(),
            mergeMap(symbol => OrderAPI.orderSub(accountPool, symbol, true)),
            tap(dingding.sendMsg),
            filter(order => order['order-state'] === cons.OrderState.filled)
        ).subscribe(data => {
            Grid.orderSubHandler(data)
        })

        taskObservable.pipe(
            delay(2000),
            mergeMap(tasks => from(tasks)),
            concatMap(task => zip(of(task), Grid.getTaskOpenOrders(task.id))),
            concatMap(([
                task,
                orders
            ]) => this.placeOrdersByTask(task, orders))
        ).subscribe(
            data => getLogger().info(data),
            err => getLogger().error(err)
        )
    }

    //after account pool authed
    start (accountPool) {
        getLogger().info('grid strategy starting...')

        this.handleOpenTasks(accountPool)
        //cancel closed tasks
        Grid.handleClosedTasks()
    }
}