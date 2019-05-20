import {
    Subject,
    from,
    interval,
    merge
} from 'rxjs';
import {
    cons,
    ws
} from '../base';
import {
    delay,
    mapTo,
    throttle,
    throttleTime
} from 'rxjs/operators';

import {
    getLogger
} from 'log4js';

export default class WebsocketPool {

    constructor (url, aliveCheckInterval = 30000, responseHeartbeatFunc) {
        this.url = url
        this.client = null
        this.messageQueue = new Subject()

        this.restartSubject = new Subject()

        this.aliveCheckInterval = aliveCheckInterval

        this.responseHeartbeatFunc = responseHeartbeatFunc

        this.restartSubject.pipe(
            throttleTime(aliveCheckInterval/2)
        ).subscribe(() => {
            getLogger().info(`websocket ${this.url} may be disconnected. try reconnect.`)
            this.start()
        })
    }

    start () {
        this.client = ws.create(this.url)
        const messageObservable = ws.buildObservable(this.client)

        messageObservable.subscribe(
            data => {
                getLogger().info(data)
                this.messageQueue.next(data)
            },
            cons.EMPTY_ERR_HANDLER
        )

        this.heartbeat(messageObservable)
    }

    send (messaage) {
        getLogger().info(`send message:${JSON.stringify(messaage)}`)
        try {
            this.client.send(JSON.stringify(messaage))
        } catch (err) {
            getLogger().error(err)
            this.restartSubject.next(2)
        }
    }


    heartbeat (messageObservable) {
        let lastReceived = ''

        const subscription = merge(
            interval(this.aliveCheckInterval).pipe(mapTo('timer')),
            messageObservable
        ).subscribe(
            data => {
                if (lastReceived === 'timer' && data === 'timer') {
                    lastReceived = ''
                    subscription.unsubscribe()
                    // restart all 
                    this.restartSubject.next(1)

                    return
                }

                lastReceived = data

                this.responseHeartbeatFunc(data)
            },
            err => {
                console.error(err);
                from([1]).pipe(delay(1000 * 5)).subscribe(() => this.restartSubject.next(2))
            }
        )
    }
}