 
export const    MarketWebSocket= 'wss://api.huobi.pro/ws'
export const    AccountWebSocket= 'wss://api.huobi.pro/ws/v1'

export const    OP= 'op'
export const    OP_AUTH= 'auth'
export const    OP_ACCOUNTS= 'accounts'

export const    REQ= 'req'
export const    REQ_ACCOUNTS_LIST= 'accounts.list'
export const    REQ_ORDER_DETAIL= 'orders.detail'

export const    NOTIFY= 'notify'

export const    PING= 'ping'
export const    PONG= 'pong'

export const    SUB= 'sub'

export const    ERR_CODE= 'err-code'

export const    AccountAPI= 'https://api.huobi.pro'
export const    OpenOrders= '/v1/order/openOrders'
export const    PlaceOrder= '/v1/order/orders/place'
export const    BatchCancelOrder= '/v1/order/orders/batchcancel'
export const    OrderHistory= '/v1/order/history'
export const    Orders= '/v1/order/orders'

export const Accounts = '/v1/account/accounts'
// export const AccountBalance = '/v1/account/accounts/{account-id}/balance'


export const    MarketAPI= 'https://api.huobi.pro'
export const    MarketDetailMerged= '/market/detail/merged'
export const    MarketSymbols = '/v1/common/symbols'

export const    GET= 'get'
export const    POST= 'post'

export const    EMPTY_ERR_HANDLER= () => {}

export const    OrderType= {
    buyLimit: 'buy-limit',
    sellLimit: 'sell-limit',
    sellLimitMaker: 'sell-limit-maker',
    buyLimitMaker: 'buy-limit-maker'
}
export const    OrderState= {
    filled: 'filled',         
    partialFilled: 'partial-filled',
    submitted: 'submitted',      
    partialCanceled: 'partial-canceled',
    canceled: 'canceled'
}
export const    BaseCurrency= [
    'btc',
    'usdt',
    'husd',
    'eth',
    'ht',
    'eos'
]