import {OrderState, OrderType} from '../base/const'
import {Orders, Tasks, sequelize} from '../base/types'
import {concatMap, delay, distinct, filter, flatMap, map, mergeMap, share, tap, toArray} from 'rxjs/operators';
import {from, of, zip} from 'rxjs';
import {orderBatchCancelByHttp, orderDetailReqByHttp, orderPlaceReqByHttp, orderSub} from '../api/order'

import BigNumber from 'bignumber.js';
import Op from 'sequelize/lib/operators'
import {getAccountIdByType} from '../handler/account_balance'
import {getLogger} from 'log4js';
import {marketMergedDetailByHttp} from '../api/spot_market'

//checkout task 0 closed 1 normal
const getTasksByState = function getTasksByState (state){
    return from(sequelize.authenticate()).pipe(
        mergeMap(()=>  from(Tasks.findAll({
            where: {
                state
            }
        }))),
        share()
    )
} 

//check task orders state after all orders ready
const getTaskOpenOrders = function getTaskOpenOrders (taskId){
    return from(sequelize.authenticate()).pipe(
        mergeMap(()=>  Orders.findAll({
            where: {
                'task-id': taskId,
                'order-state': {
                    [Op.or]: [
                        OrderState.submitted,
                        OrderState.partialFilled
                    ]
                }
            }
        })),
        mergeMap(orders => from(orders)),
        concatMap(order => orderDetailReqByHttp(order['order-id'])),
        filter(order => order['order-state'] === OrderState.submitted || order['order-state'] === OrderState.partialFilled),
        toArray()
        )
}

const handleTask = function handleTask (task, orders) {
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

    if(orderPrices.keys >0){
        throw new Error(`open orders price: ${orderPrices.keys} not expected`)
    }

    if(lackPrices.length === 0){
        //wired should be at least one for the gap.
        getLogger().warn(`task ${task} is wired. no lack price for it.`)
    }

    //get current price
    return marketMergedDetailByHttp(task.symbol).pipe(
        map(data => data.close),
        //generate orders to submit
        flatMap(curPrice => from(lackPrices).pipe(
            map(price => ({
                'account-id': getAccountIdByType('spot'),
                symbol: task.symbol,
                price: String(price),
                amount: task['grid-amount'],
                type: new BigNumber(curPrice).gt(new BigNumber(price)) 
            ? OrderType.buyLimitMaker 
             : OrderType.sellLimitMaker
            })))),
         //todo should I check if balance enough
        concatMap(order => orderPlaceReqByHttp(order)),
        filter(data => data.status === 'ok'),
        map(data => data.data),
        //save into db
        flatMap(orderId => from(Orders.upsert({
            'order-id': orderId,
            'task-id': task.id
        }))),
        toArray()
    )
}

const getNextPrice = function getNextPrice (order, gridPrices) {
    let numberGridPrices = []
    gridPrices.forEach(item => numberGridPrices.push(new BigNumber(item)))
    numberGridPrices.sort((a, b)=> {
        if (a.gt(b)){
            return 1
        }else if(a.eq(b)){
            return 0
        }

        return -1
    })

    let nextPrice = null
    if(order['order-type']=== OrderType.buyLimitMaker){
        for(let price of numberGridPrices){
            if(price.gt(new BigNumber(order.price))){
                nextPrice = price.toFixed() 
                break
            }
        }
         
    }else if (order['order-type'] === OrderType.sellLimitMaker) {
        for(let [
                    i,
                    price
                ] of numberGridPrices.entries()){

            if(price.gte(new BigNumber(order.price))){
                if(i > 0) {
                    nextPrice = numberGridPrices[i-1].toFixed()
                    break
                } 
            }
        }
    }else {
        throw new Error(`unexpcet order type: ${order}`)
    }

    return nextPrice
}

const orderSubHandler = function  orderSubHandler (order) {
    let taskId = null
    //get orde from db check if is task order
    from(Orders.findOne({
        where: {'order-id': order['order-id']} 
    })).pipe(
        filter(data => data['task-id'] > 0),
        mergeMap(data => from(Tasks.findOne({where: {'id': data['task-id']}}))),
        filter(data => data),
        concatMap(task => {
            taskId = task.id
            // get task by id check next order price 
            const price = getNextPrice(order, task['grid-prices'].split(','))
            //check if this pos has order
            return from(Orders.findOne({
                where: {'task-id': taskId,
                    price,
                    'order-state': {
                        [Op.or]: [
                            OrderState.submitted,
                            OrderState.partialFilled
                        ]
                    }}
            })).pipe(
                filter(data => !data),
                // place order 
                mergeMap(()=> orderPlaceReqByHttp({
                    'account-id': getAccountIdByType('spot'),
                    symbol: task.symbol,
                    price,
                    amount: task['grid-amount'],
                    type: order['order-type'] === OrderType.buyLimitMaker 
                    ? OrderType.sellLimitMaker 
                    : OrderType.buyLimitMaker 
                }))
            )
        }),
        filter(data => data.status === 'ok'),
        map(data => data.data),
        //save into db
        flatMap(orderId => from(Orders.upsert({
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

const handleClosedTasks = function handleClosedTasks (){
    getTasksByState(0).pipe(
        mergeMap(tasks => from(tasks)),
        concatMap(task => getTaskOpenOrders(task.id)),
        mergeMap(orders => from(orders)),
        map(order => order['order-id']),
        toArray(),
        concatMap(orderIds => orderBatchCancelByHttp(orderIds)),
        flatMap(data => from(data.success)),
        concatMap(orderId => from(Orders.update({
            'order-state': OrderState.canceled 
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

let subscriptions  = null

const handleOpenTasks = function handleOpenTasks (accountPool){
    if(subscriptions){
        subscriptions.unsubscribe()
    }


    //open tasks
    const taskObservable = getTasksByState(1)

    subscriptions = taskObservable.pipe(
        mergeMap(tasks => from(tasks)),
        map(task => task.symbol),
        distinct(),
        toArray(),
        mergeMap(symbol => orderSub(accountPool, symbol)),
        filter(order => order['order-state'] === OrderState.filled)
    ).subscribe(data => orderSubHandler(data))

    taskObservable.pipe(
        //make sure sub success
        delay(1000),
        mergeMap(tasks => from(tasks)),
        concatMap(task => zip(of(task), getTaskOpenOrders(task.id))),
        concatMap(([
                task,
                orders
                ])=> handleTask(task, orders))
    ).subscribe(
        data => console.log(data),
        err => console.error(err)
    )
}

//after account pool authed
const start = function start (accountPool){

    of(1).pipe(
        delay(3000)
    ).subscribe(
        ()=> {
            handleOpenTasks(accountPool)

            //cancel closed tasks
            handleClosedTasks()
        }
    )
}

module.exports = {
    start
}