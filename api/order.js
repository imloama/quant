import {
    AccountAPI,
    EMPTY_ERR_HANDLER,
    GET,
    NOTIFY,
    OpenOrders,
    OrderHistory,
    POST,
    PlaceOrder,
    REQ,
    REQ_ORDER_DETAIL,
    SUB
} from '../base/const'
import {
    Subject,
    from
} from 'rxjs';
import {
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
import rest from '../base/rest'

const openOrderReq = function openOrderReq () {
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

const orderPlaceReq = function orderPlaceReq (params) {
    return from(
        rest.get(AccountAPI + PlaceOrder, addSignature({
            url: AccountAPI + PlaceOrder,
            method: POST,
            params
        }, awsParams))
    ).pipe(
        share()
    )
}
const orderHistory = function orderHistory (params) {
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
const orderDetailReq = function orderDetailReq (client, messageObservable, orderId) {
    client.send(JSON.stringify({
        op: REQ,
        topic: REQ_ORDER_DETAIL,
        'order-id': String(orderId)
    }))

    const subject = new Subject()
    messageObservable.pipe(
        filter(data => data.op === REQ && data.topic === REQ_ORDER_DETAIL),
        map(data => {
            const result = data.data

            result['order-id'] = result.id
            Reflect.deleteProperty(data, 'id')
            result['order-amount'] = result.amount
            result['order-type'] = result.type
            result['order-source'] = result.source
            result['order-state'] = result.state

            return result
        })
    ).subscribe(subject)

    return subject
}

const orderSub = function orderSub (client, messageObservable, symbols) {
    from(symbols).pipe().subscribe(
        symbol => client.send(JSON.stringify({
            op: SUB,
            topic: `orders.${symbol}`
        })),
        EMPTY_ERR_HANDLER
    )

    return messageObservable.pipe(
        filter(msg => msg.op === NOTIFY && msg.topic.includes('orders')),
        map(data => data.data),
    )
}


module.exports = {
    openOrderReq,
    orderPlaceReq,
    orderSub,
    orderDetailReq,
    orderHistory
}