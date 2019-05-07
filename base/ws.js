/*
 *这个文件夹的主要工作就是建立底层的通信框架，尽量屏蔽底层交互
 */
const WS = require('ws')
const pako = require('pako')
const rxjs = require('rxjs')
const operators = require('rxjs/operators')

const create = function create (url) {
    const client = new WS(url)
    return client
}

const buildObservable = function buildObservable (client) {
    return rxjs.Observable.create(observer => {
        try {
            client.on('open', () => observer.next({
                messageType: 'open'
            }))

            client.on('close', () => observer.next({
                messageType: 'close'
            }))

            client.on('message', data => {
                let unziped = JSON.parse(pako.inflate(data, {
                    to: 'string'
                }))
                unziped.messageType = 'message'
                observer.next(unziped)
            })

            client.on('error', err => observer.error(err))
        } catch (error) {
            client.on('error', err => observer.error(err))
        }
    }).pipe(
        operators.share()
    )
}

module.exports = {
    create,
    buildObservable
}