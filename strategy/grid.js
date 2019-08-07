import Sequelize, {Op} from 'sequelize'
import {from, Subject, of, interval, zip} from 'rxjs';
import {mergeMap, map, flatMap, toArray, filter, reduce, concatMap, delay, tap, debounceTime, catchError, retry, distinct} from 'rxjs/operators'
import {cons} from '../base';
import market from '../service/market';
import BigNumber from 'bignumber.js';
import {getLogger} from 'log4js';
import {getSymbolInfo} from '../base/common';
import * as config from '../config'
import {dingding} from '../notifier';

export default class Grid {

    constructor (sequelize, authService, orderService, accountService){
        this.authService = authService
        this.orderService = orderService
        this.accountService = accountService

        this.DBTask = Grid.initDB(sequelize)
        this.DBTask.sync({
            force: false 
        })

        this.TaskOrderTable = Grid.initTaskOrderTable(sequelize)
        this.TaskOrderTable.sync({
            force: false 
        })

        this.taskCheckSubject = new Subject()

        this.taskCheckSubject.pipe(
            tap(() => getLogger().debug('start check task info')),
            debounceTime(1000),
            mergeMap(taskID => from(taskID
                ? this.DBTask.findAll({
                    where: {
                        id: taskID
                    }
                })
                : this.DBTask.findAll())),
            mergeMap(tasks => from(tasks)),
            concatMap(task => from(task.state === 1
                 ? this.handleOpenTask(task)
                 : this.handleClosedTask(task))),
            // catchError(err => of(`caught error:${err}`)),
            retry(10),
        ).subscribe(
            data => getLogger().info(data),
            err => getLogger().error(err)
        )

        //check periodly
        interval(config.grid.taskCheckInterval).subscribe(()=> this.taskCheckSubject.next(null))
    }

    static initTaskOrderTable (sequelize) {
        return sequelize.define('task_order', 
            {id: {
                type: Sequelize.INTEGER(11),
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
            },
                'task-id': {
                    type: Sequelize.INTEGER(11)
                },
                'order-id': {
                    type: Sequelize.BIGINT
                }},
            {
                indexes: [
                    {
                        unique: true,
                        fields: [
                            'task-id',
                            'order-id'
                        ]
                    },
                    {
                        fields: ['task-id']
                    },
                    {
                        fields: ['order-id']
                    }

                ]
            })
    }

    static initDB (sequelize) {
        return  sequelize.define('task', {
            id: {
                type: Sequelize.INTEGER(11),
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
            },
            'symbol': {
                type: Sequelize.STRING
            },
            'start-price': {
                type: Sequelize.STRING
            },
            'end-price': {
                type: Sequelize.STRING
            },
            'grid-rate': {
                type: Sequelize.STRING

            },
            'grid-count': {
                type: Sequelize.STRING

            },
            'grid-amount': {
                type: Sequelize.STRING
            },
            'grid-prices': {
                type: Sequelize.STRING(1024)
            },
            //0 invalid 1 normal
            'state': {
                type: Sequelize.TINYINT 
            }
        })
    }

    async start (){
        //check task info 
        await from(this.DBTask.findAll()).pipe(
            tap(tasks => this.addOrderSubscriber(tasks)),
            mergeMap(tasks => from(tasks)),
            //sync order to lastesd
            concatMap(task => zip(of(task), from(this.orderService.syncOrderInfo(task.symbol)))),
            concatMap(([task]) => from(task.state === 1
                 ? this.handleOpenTask(task)
                 : this.handleClosedTask(task))),
            toArray()
        ).toPromise()
    }

    addOrderSubscriber (tasks){
        if(this.subscription){
            this.subscription.unsubscribe()
        }

        this.subscription = from(tasks).pipe(
            map(task => task.symbol),
            distinct(),
            toArray(),
            mergeMap(symbols => this.orderService.orderSub(symbols)),
            tap(msg => dingding.sendMsg(msg)),
            concatMap(order => zip(of(order), from(this.orderService.saveOrder(order)))),
            filter(([order]) => order['order-state'] === cons.OrderState.filled),
            map(([order])=> order['order-id']),
            concatMap(orderID => this.TaskOrderTable.findOne({
                where: {
                    'order-id': orderID
                }
            })),
            filter(data =>data),
        ).subscribe(
            data => this.taskCheckSubject.next(data['task-id']),
            err => getLogger().error(err) 
        )
    }

    getTaskOpenOrders (taskId) {
        return from(this.TaskOrderTable.findAll({
            where: {
                'task-id': taskId         
            }
        })).pipe(
            mergeMap(datas => from(datas)),
            map(data => data['order-id']),
            toArray(),
            flatMap(orderIds => this.orderService.loadOrdersFromDB({
                where: {
                    'order-id': {
                        [Op.in]: orderIds
                    },
                    'order-state': {
                        [Op.in]: [
                            cons.OrderState.submitted,
                            cons.OrderState.partialFilled
                        ]
                    }
                }
            }))
        ).toPromise()
    }

    async handleOpenTask (task) {
        getLogger().info(`handle open tasks:${JSON.stringify(task)}`)
        //get current price
        const curPrice = await market.getMergedDetail(task.symbol).then(data => data.close)

        const orderPrices = await from(this.getTaskOpenOrders(task.id)).pipe(
            mergeMap(orders => from(orders)),
            map(order => order['order-price']),
            reduce((acc, value)=> {
                acc.set(new BigNumber(value).toFixed(8), '')
                return acc
            }, new Map())
        ).toPromise() 

        getLogger().debug(`cur price: ${curPrice}`)
        getLogger().debug(`cur order priceses: ${Array.from(orderPrices.keys()).toString()}`)

        //check out lack price
        const lackPrices = await from(task['grid-prices'].split(',')).pipe(
            filter(price => !orderPrices.has(new BigNumber(price).toFixed(8))),
            toArray(),
            filter(prices => prices.length > 1),
            mergeMap(prices => from(prices)),
            filter(price => new BigNumber(price).minus(new BigNumber(curPrice)).abs().div(BigNumber.min(curPrice, price)).comparedTo(new BigNumber(task['grid-rate']).div(2)) >= 0),
            tap(price => getLogger().debug(`price passed filter: ${price}`)),
            map(price => ({
                price,
                orderType: new BigNumber(price).comparedTo(curPrice) <=0 
                ?cons.OrderType.buyLimitMaker
                : cons.OrderType.sellLimitMaker
            })),
            toArray()
        ).toPromise()

        if (lackPrices.length <= 0) {
            getLogger().warn(`task ${task} has no lack price for it.`)
        } else {
            getLogger().warn(`task ${task} lack price: ${lackPrices.map(x => x.price)}`)
        }

        
        //check whether balance is enough or not 
        const symbolInfo = getSymbolInfo(task.symbol) 
        const balanceNeeded = new Map()        
        balanceNeeded.set(symbolInfo.trader, new BigNumber(0))
        balanceNeeded.set(symbolInfo.base, new BigNumber(0))

        lackPrices.forEach(item => {
            if(item.orderType === cons.OrderType.buyLimitMaker || item.orderType === cons.OrderType.buyLimit){
                balanceNeeded.set(symbolInfo.base, balanceNeeded.get(symbolInfo.base).plus(new BigNumber(item.price).times(task['grid-amount'])))
            }else if(item.orderType === cons.OrderType.sellLimitMaker || item.orderType === cons.OrderType.sellLimit){
                balanceNeeded.set(symbolInfo.trader, balanceNeeded.get(symbolInfo.trader).plus(task['grid-amount']))
            }else{
                throw new Error(`unexpected order type ${item.orderType}`)
            }
        })

        const account = await this.accountService.getAccountByType('spot');
        const balance = await from(this.accountService.getBalance(account)).pipe(
            flatMap(data => from(data.list)),
            filter(balance => balance.type === 'trade'),
            tap(data => {
                if(data.balance !== '0'){
                    console.log(data)
                }
            }),
            reduce((acc, value)=> {
                acc.set(value.currency, value)
                return acc
            }, new Map()),
        ).toPromise()
        
        for(const [
                key,
                value
                ] of balanceNeeded){
            if(new BigNumber(value).comparedTo(new BigNumber(balance.get(key).balance))>0){
                getLogger().warn(`task ${task.id} need ${key} ${value}, but account just has ${balance.get(key).balance}`)
                return
            }

            getLogger().info(`task ${task.id} need ${key} ${value}, account has ${balance.get(key).balance}`)
        }

        //place order
        await from(lackPrices).pipe(
            concatMap(priceInfo => this.orderService.placeOrder(account.id, task.symbol, priceInfo.price, task['grid-amount'], priceInfo.orderType, task.id).pipe(delay(200))),
            map(placeResult => ({
                'task-id': task.id,
                'order-id': placeResult.data
            })),
            toArray(),
            concatMap(data => this.TaskOrderTable.bulkCreate(data))
        ).toPromise()
    }

    async handleClosedTask (task){
        getLogger().info(`handle closed tasks:${JSON.stringify(task)}`)
        //get task orders
        const result = await from(this.getTaskOpenOrders(task.id)).pipe(
            flatMap(orders => from(orders)),
            map(order => order['order-id']),
            toArray(),
            concatMap(orderIds => this.orderService.batchCancel(orderIds)),
        ).toPromise()

        getLogger().info(`batch cancel orders ${result} success`)
    }
}