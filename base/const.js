module.exports = {
    MarketWebSocket: 'wss://api.huobi.pro/ws',
    AccountWebSocket: 'wss://api.huobi.pro/ws/v1',

    OP: 'op',
    OP_AUTH: 'auth',
    OP_ACCOUNTS: 'accounts',

    REQ: 'req',
    REQ_ACCOUNTS_LIST: 'accounts.list',
    REQ_ORDER_DETAIL: 'orders.detail',

    NOTIFY: 'notify',

    PING: 'ping',
    PONG: 'pong',

    SUB: 'sub',

    ERR_CODE: 'err-code',

    AccountAPI: 'https://api.huobi.pro',
    OpenOrders: '/v1/order/openOrders',
    PlaceOrder: '/v1/order/orders/place',
    OrderHistory: '/v1/order/history',
    Orders: '/v1/order/orders',

    GET: 'get',
    POST: 'post',

    EMPTY_ERR_HANDLER: err => {}
}