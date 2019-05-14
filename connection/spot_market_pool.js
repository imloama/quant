import {
    EMPTY_ERR_HANDLER,
    MarketWebSocket
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
    getLogger
} from '../base/logger'
import {
    messagePoolAliveCheckInterval
} from '../config.js'

const pool = {
    messageQueue: new Subject()
}

let client = null

//for auto restart 
const restartSubject = new Subject()
restartSubject.subscribe(
    () => {
        getLogger().warn('market websocket may be disconnected. try reconnect.')
        main(restartSubject)
    }
)

const heartbeat = function heartbeat (client, messageObservable, restartSubject) {
    let lastReceived = ''

    const subscription = merge(
        interval(messagePoolAliveCheckInterval).pipe(mapTo('timer')),
        messageObservable.pipe(filter(data => data.ping))
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
                if (data.ping) {
                    const msg = {
                        pong: data.ping
                    }

                    getLogger('debug').debug('send message:', msg)
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
    client = create(MarketWebSocket)
    const messageObservable = buildObservable(client)

    messageObservable.subscribe(
        data => {
            getLogger('debug').debug(data)
            pool.messageQueue.next(data)
        },
        EMPTY_ERR_HANDLER
    )

    heartbeat(client, messageObservable, restartSubject)
}


pool.send = function send (messaage) {
    getLogger('debug').debug(`send message:${JSON.stringify(messaage)}`)
    try {
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