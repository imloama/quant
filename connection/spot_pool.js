import WebsocketPool from './ws_pool';
import config from '../config';
import {
    cons
} from '../base';
export default class SpotAccount extends WebsocketPool {
    constructor () {
        super(cons.AccountWebSocket, config.messagePoolAliveCheckInterval)
        this.responseHeartbeatFunc = this.responseHeartbeat
    }

    responseHeartbeat (data) {
        if (data && data.ts && data.op === cons.PING) {
            this.send({
                op: cons.PONG,
                ts: data.ts
            })
        }
    }
}