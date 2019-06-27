import WebsocketPool from './ws_pool'
import config from '../config';
import {
    cons
} from '../base';
export default class SpotMarket extends WebsocketPool {
    constructor () {
        super(cons.MarketWebSocket, config.messagePoolAliveCheckInterval)
        this.responseHeartbeatFunc = this.handleHeartbeat
    }

    handleHeartbeat (data) {
        if (data && data.ping) {
            this.send({
                pong: data.ping
            })
        }
    }
}