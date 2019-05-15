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
    BatchCancelOrder: '/v1/order/orders/batchcancel',
    OrderHistory: '/v1/order/history',
    Orders: '/v1/order/orders',

    MarketAPI: 'https://api.huobi.pro',
    MarketDetailMerged: '/market/detail/merged',

    GET: 'get',
    POST: 'post',

    EMPTY_ERR_HANDLER: err => {},

    OrderType: {
        buyLimit: 'buy-limit',
        sellLimit: 'sell-limit',
        sellLimitMaker: 'sell-limit-maker',
        buyLimitMaker: 'buy-limit-maker'
    },
    OrderState: {
        filled: 'filled',         
        submitted: 'submitted',      
        partialFilled: 'partial-filled',
        canceled: 'canceled'
    },

    BaseCurrency: [
        'btc',
        'usdt',
        'husd',
        'eth',
        'ht',
        'eos'
    ]
}