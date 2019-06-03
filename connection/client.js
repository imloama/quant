import WebSocket from 'ws'
import {Observable} from 'rxjs';
import pako from 'pako';

export default class Client {
    constructor (url){
        this.client = new WebSocket(url) 
    }

    connect (){
        return Observable.create(observer => {
            try {
                this.client.on('open', () => observer.next({
                    messageType: 'open'
                }))

                this.client.on('close', () => observer.next({
                    messageType: 'close'
                }))

                this.client.on('message', data => {
                    let unziped = JSON.parse(pako.inflate(data, {
                        to: 'string'
                    }))
                    unziped.messageType = 'message'
                    observer.next(unziped)
                })

                this.client.on('error', err => observer.error(err))
            } catch (error) {
                this.client.on('error', err => observer.error(err))
            }
        })
    }

    send (message) {
        this.client.send(message)
    }
}