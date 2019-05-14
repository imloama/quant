import {
    AccountAPI,
    BatchCancelOrder,
    EMPTY_ERR_HANDLER,
    GET,
    NOTIFY,
    OpenOrders,
    OrderHistory,
    Orders,
    POST,
    PlaceOrder,
    REQ,
    REQ_ORDER_DETAIL,
    SUB
} from '../base/const'
import {
    concatMap,
    filter,
    flatMap,
    map,
    share,
    toArray
}
from 'rxjs/operators';

import {
    addSignature
} from './aws'
import {
    awsParams
} from '../config';
import {
    from
} from 'rxjs';
import rest from '../base/rest'

const openOrderReqByHttp = function openOrderReqByHttp () {
    let params = {
        // 'account-id': accountId,
        size: 500
    }

    return from(
        rest.get(AccountAPI + OpenOrders, addSignature({
            url: AccountAPI + OpenOrders,
            method: GET,
            params
        }, awsParams))
    ).pipe(
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
        share()
    )
}

const orderPlaceReqByHttp = function orderPlaceReqByHttp (params) {
    return from(
        rest.post(AccountAPI + PlaceOrder, params, addSignature({
            url: AccountAPI + PlaceOrder,
            method: POST,
            params: {}
        }, awsParams))
    ).pipe(
        share()
    )
}

const orderBatchCancelByHttp = function  orderBatchCancelByHttp (orderIds) {
    const batchIds = []

    while(orderIds.length > 50){
        batchIds.push(orderIds.slice(0, 51))
        orderIds = orderIds.slice(51)
    }
    if(orderIds.length > 0){
        batchIds.push(orderIds)
    }

    return from(batchIds).pipe(
        concatMap(ids => rest.post(AccountAPI + BatchCancelOrder, {
            'order-ids': ids
        }, addSignature({
            url: AccountAPI + BatchCancelOrder,
            method: POST,
            params: {}
        }, awsParams))),
        filter(data => data.status === 'ok'),
        map(data => data.data),
        share()
    )
}

const orderHistoryReqByHttp = function orderHistoryReqByHttp (params) {
    return from(
        rest.get(AccountAPI + OrderHistory, addSignature({
            url: AccountAPI + OrderHistory,
            method: GET,
            params
        }, awsParams))
    ).pipe(
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
            return data
        }),
        toArray(),
        share()
    )
}

const orderDetailReqByHttp = function orderDetailReqByHttp (orderId) {
    const url = AccountAPI + Orders + `/${orderId}`
    return from(rest.get(url, addSignature({
        url,
        method: GET,
        params: {}
    }, awsParams))).pipe(
        filter(data => data.status === 'ok'),
        map(data => {
            const result = data.data

            result['order-id'] = result.id
            Reflect.deleteProperty(result, 'id')
            result['order-amount'] = result.amount
            result['order-type'] = result.type
            result['order-source'] = result.source
            result['order-state'] = result.state

            result['filled-amount'] = result['field-amount']
            result['filled-cash-amount'] = result['field-cash-amount']
            result['filled-fees'] = result['field-fees']

            return result
        })
    )
}

const orderDetailReq = function orderDetailReq (pool, orderId) {
    pool.send({
        op: REQ,
        topic: REQ_ORDER_DETAIL,
        'order-id': String(orderId)
    })

    return pool.messageQueue.pipe(
        filter(data => data.op === REQ && data.topic === REQ_ORDER_DETAIL),
        map(data => {
            const result = data.data

            result['order-id'] = result.id
            Reflect.deleteProperty(result, 'id')
            result['order-amount'] = result.amount
            result['order-type'] = result.type
            result['order-source'] = result.source
            result['order-state'] = result.state

            result['filled-amount'] = result['field-amount']
            result['filled-cash-amount'] = result['field-cash-amount']
            result['filled-fees'] = result['field-fees']


            return result
        })
    )
}

const orderSub = function orderSub (pool, symbols) {
    from(symbols).pipe().subscribe(
        symbol => pool.send({
            op: SUB,
            topic: `orders.${symbol}`
        }),
        EMPTY_ERR_HANDLER
    )

    return pool.messageQueue.pipe(
        filter(msg => msg.op === NOTIFY && msg.topic.includes('orders')),
        map(data => data.data),
    )
}


module.exports = {
    orderSub,
    orderDetailReq,
    openOrderReqByHttp,
    orderPlaceReqByHttp,
    orderDetailReqByHttp,
    orderHistoryReqByHttp,
    orderBatchCancelByHttp
}