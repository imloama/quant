import Sequelize, {Op} from 'sequelize'
import {from} from 'rxjs';
import {mergeMap, map, flatMap, toArray, filter, reduce, concatMap, delay} from 'rxjs/operators'
import {cons} from '../base';
import market from '../service/market';
import BigNumber from 'bignumber.js';
import {getLogger} from 'log4js';
import {getSymbolInfo} from '../base/common';

export default class Grid {

    constructor (sequelize, authService, orderService, accountService){
        this.authService = authService
        this.orderService = orderService
        this.accountService = accountService

        this.DBTask = Grid.initDB(sequelize)
        this.DBTask.sync()

        this.TaskOrderTable = Grid.initTaskOrderTable(sequelize)
        this.TaskOrderTable.sync()
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
                    type: Sequelize.INTEGER(11)
                }},
            {
                indexes: [
                    {
                        unique: true,
                        fields: [
                            'task-id',
                            'order-id'
                        ]
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
        //sub order info

        //check task info 
        await from(this.getOpenTasks()).pipe(
            mergeMap(tasks => from(tasks)),
            concatMap(task => from(this.handleOpenTask(task))),
            toArray()
        ).toPromise()
    }

    getOpenTasks (){
        return  this.DBTask.findAll({
            where: {
                state: 1
            }
        })
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

        //sync order to lastesd
        await this.orderService.syncOrderInfo(task.symbol)

        //get current price
        const curPrice = await market.getMergedDetail(task.symbol).then(data => data.close)

        const orderPrices = await from(this.getTaskOpenOrders(task.id)).pipe(
            mergeMap(orders => from(orders)),
            map(order => order['order-price']),
            reduce((acc, value)=> {

                acc.set(value, '')
                return acc
            }, new Map())
        ).toPromise() 

        //check out lack price
        const lackPrices = await from(task['grid-prices'].split(',')).pipe(
            filter(price => !orderPrices.has(price) &&
             new BigNumber(price).minus(new BigNumber(curPrice)).abs().div(BigNumber.min(curPrice, price)).compareTo(new BigNumber(task['grid-rate']).div(2)) >= 0),
            map(price => ({
                price,
                orderType: new BigNumber(price).compareTo(curPrice) <=0 
                ?cons.OrderType.buyLimitMaker
                : cons.OrderType.sellLimitMaker
            })),
            toArray()
        ).toPromise()

        if (lackPrices.length <= 0) {
            getLogger().warn(`task ${task} has no lack price for it.`)
        } else {
            getLogger().warn(`task ${task} lack price: ${lackPrices}`)
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

        const balance = await from(this.accountService.getAccountByType('spot')).pipe(
            mergeMap(account => from(this.accountService.getBalance(account))),
            flatMap(data => data.list),
            filter(balance => balance.type === 'trade'),
            reduce((acc, value)=> {
                acc.set(value.currency, value)
                return acc
            }, new Map())
        ).toPromise()
        
        for(const key in balanceNeeded.keys){
            if(new BigNumber(balanceNeeded.get(key)).comparedTo(new BigNumber(balance.get(key).balance))>0){
                getLogger().warn(`task ${task.id} need ${key} ${balanceNeeded.get(key)}, but account just has ${balance.get(key).balance}`)
                return
            }
        }

        //place order
        await from(lackPrices).pipe(
            concatMap(priceInfo => this.orderService.placeOrder(task.symbol, priceInfo.price, task['grid-amount'], priceInfo.orderType)).pipe(delay(200)),
            toArray()
        ).toPromise()
    }


}