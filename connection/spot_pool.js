import {
    Subject,
    from,
    interval,
    merge
} from 'rxjs';
import {cons, ws} from '../base';
import {
    delay,
    filter,
    mapTo
}
from 'rxjs/operators';

import config from '../config';
import {create} from 'domain';
import {getLogger} from 'log4js';

const pool = {
    messageQueue: new Subject()
}

let client = null

//for auto restart 
const restartSubject = new Subject()
restartSubject.subscribe(
    () => {
        getLogger().info('websocket may be disconnected. try reconnect.')
        main(restartSubject)
    }
)

const heartbeat = function heartbeat (client, messageObservable, restartSubject) {
    let lastReceived = ''

    const subscription = merge(
        interval(config.messagePoolAliveCheckInterval).pipe(mapTo('timer')),
        messageObservable.pipe(filter(data => data.op === cons.PING))
    ).pipe(
        // tap(data => getLogger().info(data))
    ).subscribe(
        data => {
            if (lastReceived === 'timer' && data === 'timer') {
                lastReceived = ''
                subscription.unsubscribe()
                // restart all 
                restartSubject.next(1)

                return
            }

            lastReceived = data

            try {
                if (data.ts) {
                    const msg = {
                        op: cons.PONG,
                        ts: data.ts
                    }
                    getLogger().info('send message:', msg)
                    client.send(JSON.stringify(msg))
                }
            } catch (err) {
                subscription.unsubscribe()
                console.error(err)
                restartSubject.next(2)
            }
        },
        err => {
            console.error(err);
            from([1]).pipe(delay(1000 * 5)).subscribe(() => restartSubject.next(2))
        }
    )
}

const main = function main (restartSubject) {
    client = ws.create(cons.AccountWebSocket)

    const messageObservable = ws.buildObservable(client)

    messageObservable.subscribe(
        data => {
            getLogger().info(data)
            pool.messageQueue.next(data)
        },
        cons.EMPTY_ERR_HANDLER
    )

    heartbeat(client, messageObservable, restartSubject)
}


pool.send = function send (messaage) {
    getLogger().info(`send message:${JSON.stringify(messaage)}`)
    try{
        client.send(JSON.stringify(messaage))
    } catch (err) {
        console.error(err)
        restartSubject.next(2)
    }
}

pool.start = () => main(restartSubject)

module.exports = {
    pool
}