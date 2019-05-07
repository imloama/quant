import {
    AccountWebSocket,
    EMPTY_ERR_HANDLER,
    PING,
    PONG
} from '../base/const'
import {
    Subject,
    from,
    interval,
    merge
} from 'rxjs';
import {
    buildObservable,
    create
} from '../base/ws';
import {
    delay,
    filter,
    mapTo
}
from 'rxjs/operators';

import {
    messagePoolAliveCheckInterval
} from '../config.js'

const heartbeat = function heartbeat (client, messageObservable, restartSubject) {
    let lastReceived = ''

    const subscription = merge(
        interval(messagePoolAliveCheckInterval).pipe(mapTo('timer')),
        messageObservable.pipe(filter(data => data.op === PING))
    ).pipe(
        // tap(data => console.log(data))
    ).subscribe(
        data => {
            if (lastReceived === 'timer' && data === 'timer') {
                subscription.unsubscribe()
                // restart all 
                restartSubject.next(1)
                return
            }

            lastReceived = data

            try {
                client.send(JSON.stringify({
                    op: PONG,
                    ts: data.ts
                }))
            } catch (err) {
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

const pool = {
    messageQueue: new Subject()
}

const main = function main (restartSubject) {
    pool.client = create(AccountWebSocket)
    const messageObservable = buildObservable(pool.client)

    heartbeat(pool.client, messageObservable, restartSubject)

    messageObservable.subscribe(
        data => {
            console.log(data)
            pool.messageQueue.next(data)
        },
        EMPTY_ERR_HANDLER
    )
}

//for auto restart 
const restartSubject = new Subject()
restartSubject.subscribe(
    () => {
        console.log('websocket may be disconnected. try reconnect.')
        main(restartSubject)
    },
    EMPTY_ERR_HANDLER
)

module.exports = {
    pool,
    start: () => {
        main(restartSubject)
    }
}