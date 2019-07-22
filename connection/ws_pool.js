import {
    Subject,
    from,
    interval,
    merge
} from 'rxjs';
import {
    cons
} from '../base';
import {
    delay,
    mapTo,
    filter,
    debounceTime,
    tap
} from 'rxjs/operators';

import {
    getLogger
} from 'log4js';
import Client from './client';

export default class WebsocketPool {

    constructor (url, aliveCheckInterval = 30000, responseHeartbeatFunc) {
        this.url = url

        this.messageQueue = new Subject()

        this.restartSubject = new Subject()

        this.aliveCheckInterval = aliveCheckInterval

        this.responseHeartbeatFunc = responseHeartbeatFunc

        this.restartSubject.pipe(
            tap(data => getLogger().debug(`received a reconnect command:${data}`)),
            debounceTime(aliveCheckInterval/3)
        ).subscribe(() => {
            getLogger().info(`websocket ${this.url} may be disconnected. try reconnect.`)
            this.start()
        })
    }

    start () {
        this.client = new Client(this.url) 
        const messageObservable = this.client.connect() 

        messageObservable.subscribe(
            data => {
                getLogger().info(data)
                this.messageQueue.next(data)
            },
            cons.EMPTY_ERR_HANDLER
        )

        //restart when closed
        messageObservable.pipe(
            filter(data => data.messageType === 'close')
        ).subscribe(
           ()=>this.reConnect('closed'),
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
            // this.reConnect('error happens')
        }
    }

    reConnect (signal){
        getLogger().debug('reconnect ....')
        if(this.heartbeatSubscription){
            this.heartbeatSubscription.unsubscribe()
        }

        this.lastReceivedData = ''
        this.restartSubject.next(signal)
    }

    heartbeat (messageObservable) {
        this.heartbeatSubscription = merge(
            interval(this.aliveCheckInterval).pipe(mapTo('timer')),
            messageObservable
        ).subscribe(
            data => {
                if (this.lastReceivedData === 'timer' && data === 'timer') {
                    this.reConnect('timeout')

                    return
                }

                this.lastReceivedData = data

                this.responseHeartbeatFunc(data)
            },
            err => {
                getLogger().error(err)
                from([1]).pipe(delay(1000 * 5)).subscribe(()=>this.reConnect('heartbeat error happens'))
            }
        )
    }
}