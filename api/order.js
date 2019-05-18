import {
    concatMap,
    filter,
    flatMap,
    map,
    share,
    tap,
    toArray
}
from 'rxjs/operators';
import {
    cons,
    rest
} from '../base';

import {
    aws
} from '.';
import {
    awsParams
} from '../config';
import {
    from
} from 'rxjs';

export default class OrderAPI {

    static openOrderReqByHttp () {
        let params = {
            // 'account-id': accountId,
            size: 500
        }

        return from(
            rest.get(cons.AccountAPI + cons.OpenOrders, aws.addSignature({
                url: cons.AccountAPI + cons.OpenOrders,
                method: cons.GET,
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
        )
    }

    static orderPlaceReqByHttp (params) {
        return from(
            rest.post(cons.AccountAPI + cons.PlaceOrder, params, aws.addSignature({
                url: cons.AccountAPI + cons.PlaceOrder,
                method: cons.POST,
                params: {}
            }, awsParams))
        ).pipe(
            share()
        )
    }

    static orderBatchCancelByHttp (orderIds) {
        const batchIds = []

        while (orderIds.length > 50) {
            batchIds.push(orderIds.slice(0, 51))
            //eslint-disable-next-line
            orderIds = orderIds.slice(51)
        }
        if (orderIds.length > 0) {
            batchIds.push(orderIds)
        }

        return from(batchIds).pipe(
            concatMap(ids => rest.post(cons.AccountAPI + cons.BatchCancelOrder, {
                'order-ids': ids
            }, aws.addSignature({
                url: cons.AccountAPI + cons.BatchCancelOrder,
                method: cons.POST,
                params: {}
            }, awsParams))),
            filter(data => data.status === 'ok'),
            map(data => data.data),
            share()
        )
    }

    static orderHistoryReqByHttp (params) {
        return from(
            rest.get(cons.AccountAPI + cons.OrderHistory, aws.addSignature({
                url: cons.AccountAPI + cons.OrderHistory,
                method: cons.GET,
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

    static orderDetailReqByHttp (orderId) {
        const url = cons.AccountAPI + cons.Orders + `/${orderId}`
        return from(rest.get(url, aws.addSignature({
            url,
            method: cons.GET,
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

    static orderDetailReq (pool, orderId) {
        pool.send({
            op: cons.REQ,
            topic: cons.REQ_ORDER_DETAIL,
            'order-id': String(orderId)
        })

        return pool.messageQueue.pipe(
            filter(data => data.op === cons.REQ && data.topic === cons.REQ_ORDER_DETAIL),
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

    static orderSub (pool, symbols, filterWithSymbol = false) {
        const symbolMap = new Map()
        from(symbols).pipe(
            tap(symbol => symbolMap.set(symbol, true))
        ).subscribe(
            symbol => pool.send({
                op: cons.SUB,
                topic: `orders.${symbol}`
            }),
            cons.EMPTY_ERR_HANDLER
        )

        return pool.messageQueue.pipe(
            filter(msg => msg.op === cons.NOTIFY &&
                msg.topic.includes('orders') &&
                (!filterWithSymbol || symbolMap.get(msg.topic.split('.')[1]))),
            map(data => data.data),
        )
    }

}